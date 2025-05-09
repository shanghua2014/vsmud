import * as vscode from 'vscode';
import * as path from 'path';
import * as vm from 'vm';
import { promises as fs } from 'fs'; // 使用 fs/promises 模块
import { TelnetClient } from './telnetClient';
import { Files } from './files';
import { Triggers } from '../../script/trigger'; // 导入 Triggers 函数
import { handleError } from '../tools/utils';

// 判断环境
const isDevelopment = process.env.NODE_ENV === 'development ';
console.log('当前环境:', isDevelopment ? '开发环境' : '生产环境');

/**
 * 创建 HTML 编辑器类
 * 实现了一个自定义文本编辑器，用于在 Visual Studio Code 中显示和编辑 HTML 文件
 */
class createHtml implements vscode.CustomTextEditorProvider {
    private extUri: vscode.Uri;
    private context: vscode.ExtensionContext;
    private files: any;
    private fileContent: any;
    private telnet: TelnetClient | undefined;
    private triggers: any;

    /**
     * 构造函数
     * @param extensionUri 扩展的 URI
     * @param context 扩展上下文
     */
    constructor(extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
        this.extUri = extensionUri;
        this.context = context;
        this.fileContent = '';
        this.triggers = Triggers();
    }

    /**
     * 重新加载触发器
     * 从文件系统中读取并执行触发器脚本，以更新当前的触发器配置
     * @returns {Promise<boolean | null>} 加载成功返回 true，加载失败返回 null
     */
    private async reloadTriggers(): Promise<boolean | null> {
        const targetDir = path.join(__dirname, '../../vsmud/script');
        const targetPath = path.join(targetDir, 'trigger.js');

        const [code, err] = await handleError(fs.readFile(targetPath, 'utf8'));
        if (err) {
            return null;
        }

        // 定义模块类型
        interface TriggerModule {
            Triggers: () => any;
        }
        const module: { exports: TriggerModule } = { exports: { Triggers: () => [] } };
        const script = new vm.Script(code!);
        const context = vm.createContext({ module, require, exports: module.exports });
        script.runInContext(context);
        this.triggers = module.exports.Triggers();
        console.log('Triggers 已重新加载', this.triggers);

        return true;
    }

    // 定义消息处理方法的对象
    private messageHandlers: { [key: string]: (message: any, document: vscode.TextDocument, wvPanel: vscode.WebviewPanel) => Promise<void> | void } = {
        command: async (message, document, wvPanel) => {
            if (/^#[a-z]{2}/.test(message.content)) {
                if (message.content === '#reload' || message.content === '#re') {
                    this.files.copyFile(document).then(async () => {
                        await this.reloadTriggers();
                        return true;
                    });
                }
            } else {
                this.telnet?.sendData(message.content);
            }
        },
        connect: async (message, document, wvPanel) => {
            const { ip, port } = message.content;
            // 连接服务器
            this.telnet = await this.telnetToServe(ip, port, wvPanel);
        },
        save: async (message, document, wvPanel) => {
            this.files.writeFile(document, message.content);
        },
        getAccount: async (message, document, wvPanel) => {
            this.files = new Files(this.context);
            this.fileContent = await this.files.openFile(document);
            wvPanel.webview.postMessage({ type: 'getConfig', datas: this.fileContent });
        }
    };

    /**
     * 创建自定义文本编辑器
     * @param document 文档对象
     * @param webviewPanel Webview 面板对象
     * @param _token 取消令牌
     * @returns {Promise<void>} 无返回值的 Promise 对象
     */
    async resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, _token: vscode.CancellationToken): Promise<void> {
        const wvPanel = webviewPanel;
        wvPanel.webview.options = {
            enableScripts: true
        };

        let jsPath, cssPath;
        if (isDevelopment) {
            jsPath = path.join(this.extUri.fsPath, 'vsmud_vue/dev/js/main.js');
            cssPath = path.join(this.extUri.fsPath, 'vsmud_vue/dev/css/main.css');
        } else {
            jsPath = path.join(this.extUri.fsPath, 'vsmud_vue/dist/main.js');
            cssPath = path.join(this.extUri.fsPath, 'vsmud_vue/dist/main.css');
        }

        const [jsContent, jsErr] = await handleError(fs.readFile(jsPath, 'utf8'));
        const [cssContent, cssErr] = await handleError(fs.readFile(cssPath, 'utf8'));

        if (jsErr || cssErr) {
            vscode.window.showErrorMessage('无法读取 index.js 或 index.css 文件');
            return;
        }

        wvPanel.webview.html = this.getHTML({ js: jsContent!, css: cssContent! });

        // 监听来自 Vue 应用的消息
        wvPanel.webview.onDidReceiveMessage(
            async (message) => {
                console.log('命令：', message);
                for (const [key, handler] of Object.entries(this.messageHandlers)) {
                    if (key.startsWith('^')) {
                        const reg = new RegExp(key);
                        if (reg.test(message.type)) {
                            await handler(message, document, wvPanel);
                            break;
                        }
                    } else if (key === message.type) {
                        await handler(message, document, wvPanel);
                        break;
                    }
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    /**
     * 连接到服务器
     * @param ip 服务器 IP 地址
     * @param port 服务器端口号
     * @param wvPanel Webview 面板对象
     * @returns {Promise<any>} 返回 Telnet 客户端对象
     */
    private async telnetToServe(ip: string, port: number, wvPanel: vscode.WebviewPanel): Promise<any> {
        const client = new TelnetClient(ip, port);
        const [_, connectErr] = await handleError(client.connect());
        if (connectErr) {
            return;
        }

        client.onData(async (data) => {
            console.log('mud数据：', data);
            // 触发器过滤内容
            this.triggers.forEach((tri: any) => {
                const reg = new RegExp(tri.reg);
                if (reg.test(data)) {
                    if (tri.cmd) {
                        client.sendData(`${tri.cmd}\r\n`);
                    }
                    if (tri.onSuccess) {
                        const cmd = tri.onSuccess();
                        client.sendData(`${cmd}\r\n`);
                    }
                }
            });
            wvPanel.webview.postMessage({ type: 'mud', datas: data });
        });
        // 发送消息

        // 监听 Webview 被销毁的事件
        wvPanel.onDidDispose(
            () => {
                client.disconnect(); // 断开 Telnet 连接
            },
            null,
            this.context.subscriptions
        );
        return client;
    }

    /**
     * 获取 HTML 内容
     * @param imports 包含 JavaScript 和 CSS 内容的对象
     * @returns {string} HTML 字符串
     */
    private getHTML(imports: { js?: string; css?: string }): string {
        let html = `
        <!DOCTYPE html>
            <html lang="en" class="dark">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>VSMUD客户端</title>
                <style>${imports.css}</style>
                <script>window.customParent = acquireVsCodeApi();</script>
            </head>
            <body>
                <div id="app"></div>
                <script>${imports.js}</script>
            </body>
        </html>`;
        return html;
    }
}
export { createHtml };

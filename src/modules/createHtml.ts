import * as vscode from 'vscode';
import * as path from 'path';
import * as vm from 'vm';
import { promises as fs } from 'fs'; // 使用 fs/promises 模块
import { TelnetClient } from './telnetClient';
import { Files } from './files';
import { Triggers } from '../../script/trigger'; // 导入 Triggers 函数

// 判断环境
const isDevelopment = process.env.NODE_ENV === 'development ';
console.log('当前环境:', isDevelopment ? '开发环境' : '生产环境');

class createHtml implements vscode.CustomTextEditorProvider {
    private extUri: vscode.Uri;
    private context: vscode.ExtensionContext;
    private files: any;
    private fileContent: any;
    private telnet: TelnetClient | undefined;
    private triggers: any;

    constructor(extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
        this.extUri = extensionUri;
        this.context = context;
        this.fileContent = '';
        this.triggers = Triggers();
    }

    private async reloadTriggers() {
        try {
            // 检查 require 是否可用
            if (typeof require !== 'undefined') {
                const triggerPath = require.resolve('../../script/trigger');
                // 清理脚本缓存
                if (require.cache[triggerPath]) {
                    delete require.cache[triggerPath];
                }
            }

            import('../../script/trigger').then((module) => {
                this.triggers = module.Triggers(); // 重新加载 Triggers 函数
                console.log('Triggers 已重新加载', this.triggers);
            });
        } catch (error) {
            console.error('重新加载 Triggers 失败:', error);
            return null;
        }
    }

    private async reloadTriggers2() {
        try {
            const targetDir = path.join(__dirname, '../../vsmud/script');
            const targetPath = path.join(targetDir, 'trigger.js');
            console.log(targetPath);
            await fs.readFile(targetPath, 'utf8').then((code) => {
                // 定义模块类型
                interface TriggerModule {
                    Triggers: () => any;
                }
                const module: { exports: TriggerModule } = { exports: { Triggers: () => [] } };
                const script = new vm.Script(code);
                const context = vm.createContext({ module, require, exports: module.exports });
                script.runInContext(context);
                this.triggers = module.exports.Triggers();
                console.log('Triggers 已重新加载', this.triggers);
                return true;
            });
        } catch (error) {
            console.error('重新加载 Triggers 失败:', error);
            return null;
        }
    }

    // 定义消息处理方法的对象
    private messageHandlers: { [key: string]: (message: any, document: vscode.TextDocument, wvPanel: vscode.WebviewPanel) => Promise<void> | void } = {
        command: async (message, document, wvPanel) => {
            if (/^#[a-z]{2}/.test(message.content)) {
                if (message.content === '#reload' || message.content === '#re') {
                    this.files.copyFile(document).then(async () => {
                        await this.reloadTriggers2();
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

    // 父类的 resolveCustomTextEditor 接口，用于创建自定义文本编辑器
    async resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, _token: vscode.CancellationToken): Promise<void> {
        try {
            this.fileContent = '';
            const wvPanel = webviewPanel;
            wvPanel.webview.options = {
                enableScripts: true // 允许 Webview 执行脚本
            };

            let jsPath, cssPath;
            if (isDevelopment) {
                // 开发环境使用本地调试路径
                jsPath = path.join(this.extUri.fsPath, 'vsmud_vue/dev/js/main.js');
                cssPath = path.join(this.extUri.fsPath, 'vsmud_vue/dev/css/main.css');
            } else {
                jsPath = path.join(this.extUri.fsPath, 'vsmud_vue/dist/main.js');
                cssPath = path.join(this.extUri.fsPath, 'vsmud_vue/dist/main.css');
            }

            // 使用 fs 模块读取文件内容，并将其传递给 Webview
            const jsContent = await fs.readFile(jsPath, 'utf8');
            const cssContent = await fs.readFile(cssPath, 'utf8');

            wvPanel.webview.html = this.getHTML({ js: jsContent, css: cssContent });

            // 监听来自 Vue 应用的消息
            wvPanel.webview.onDidReceiveMessage(
                async (message) => {
                    console.log('命令：', message);
                    // 查找匹配的处理方法
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
                this.context.subscriptions // 使用正确的 context
            );
        } catch (err) {
            console.error('读取文件失败:', err);
            vscode.window.showErrorMessage('无法读取 index.js 或 index.css 文件');
        }
    }

    // 连接服务器
    private async telnetToServe(ip: string, port: number, wvPanel: vscode.WebviewPanel): Promise<any> {
        const client = new TelnetClient(ip, port);
        try {
            await client.connect();
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
        } catch (error) {
            console.error('操作出错:', error);
        }
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

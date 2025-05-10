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
    private extUri: vscode.Uri; // 扩展 URI
    private context: vscode.ExtensionContext; // 扩展上下文
    private fileContent: any; // 文件内容
    private telnet: TelnetClient | undefined; // Telnet 客户端
    private triggers: any; // 触发器
    private files: Files; // 文件操作实例

    constructor(extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
        this.extUri = extensionUri;
        this.context = context;
        this.fileContent = '';
        this.triggers = Triggers();
        this.files = new Files(context);
    }

    private async reloadTriggers(): Promise<boolean | null> {
        const targetPath = path.join(__dirname, '../../vsmud/script/trigger.js');

        const [code, err] = await handleError(fs.readFile(targetPath, 'utf8'));
        if (err) {
            return null;
        }

        const module: { exports: { Triggers: () => any } } = { exports: { Triggers: () => [] } };
        const script = new vm.Script(code!);
        const context = vm.createContext({ module, require, exports: module.exports });
        script.runInContext(context);
        this.triggers = module.exports.Triggers();
        console.log('Triggers 已重新加载', this.triggers);

        return true;
    }

    private messageHandlers: { [key: string]: (message: any, document: vscode.TextDocument, wvPanel: vscode.WebviewPanel) => Promise<void> | void } = {
        command: async (message, document, wvPanel) => {
            if (/^#[a-z]{2}/.test(message.content)) {
                if (message.content === '#reload' || message.content === '#re') {
                    await this.files.copyFile(document);
                    await this.reloadTriggers();
                }
            } else {
                this.telnet?.sendData(message.content);
            }
        },
        connect: async (message, document, wvPanel) => {
            const { ip, port } = message.content;
            this.telnet = await this.telnetToServe(ip, port, wvPanel);
        },
        save: async (message, document, wvPanel) => {
            this.files.writeFile(document, message.content);
        },
        getAccount: async (message, document, wvPanel) => {
            this.fileContent = await this.files.openFile(document);
            wvPanel.webview.postMessage({ type: 'getConfig', datas: this.fileContent });
        }
    };

    /**
     * 解析自定义文本编辑器
     * @param document 文本文档
     * @param webviewPanel Webview 面板
     * @param _token 取消令牌
     */
    async resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, _token: vscode.CancellationToken): Promise<void> {
        const wvPanel = webviewPanel;
        wvPanel.webview.options = { enableScripts: true };

        // 加载 JS 和 CSS 文件内容
        const [jsContent, jsErr] = await handleError(fs.readFile(this.getFilePath('js/main.js'), 'utf8'));
        const [cssContent, cssErr] = await handleError(fs.readFile(this.getFilePath('css/main.css'), 'utf8'));

        if (jsErr || cssErr) {
            vscode.window.showErrorMessage('无法读取 index.js 或 index.css 文件');
            return;
        }

        // 设置 Webview 的 HTML 内容
        wvPanel.webview.html = this.getHTML({ js: jsContent!, css: cssContent! });

        // 监听 Webview 消息
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
     * 获取文件路径
     * @param fileName 文件名
     * @returns 文件路径
     */
    private getFilePath(fileName: string): string {
        return isDevelopment ? path.join(this.extUri.fsPath, 'vsmud_vue/dev', fileName) : path.join(this.extUri.fsPath, 'vsmud_vue/dist', fileName);
    }

    private async telnetToServe(ip: string, port: number, wvPanel: vscode.WebviewPanel): Promise<TelnetClient> {
        const client = new TelnetClient(ip, port);
        await client.connect();

        client.onData(async (data) => {
            this.triggers.forEach((tri: any) => {
                const reg = new RegExp(tri.reg);
                if (reg.test(data)) {
                    if (tri.cmd) {
                        client.sendData(`${tri.cmd}\r\n`);
                    }
                    if (tri.onSuccess) {
                        client.sendData(`${tri.onSuccess()}\r\n`);
                    }
                }
            });
            wvPanel.webview.postMessage({ type: 'mud', datas: data });
        });

        wvPanel.onDidDispose(() => client.disconnect(), null, this.context.subscriptions);

        return client;
    }

    private getHTML(imports: { js?: string; css?: string }): string {
        return `
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
    }
}

export { createHtml };

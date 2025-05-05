import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs'; // 使用 fs/promises 模块
import { TelnetClient } from './telnetClient';
// import { CreateConfig } from './createConfig';
import { Files } from './files';

// 判断环境
const isDevelopment = process.env.NODE_ENV === 'development ';
console.log('当前环境:', isDevelopment ? '开发环境' : '生产环境');
class createHtml implements vscode.CustomTextEditorProvider {
    private extUri: vscode.Uri;
    private context: vscode.ExtensionContext;
    private configFile: any;
    private files: any;
    private fileContent: any;
    private telnet: TelnetClient | undefined;

    constructor(extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
        this.extUri = extensionUri;
        this.context = context;
        this.fileContent = '';
    }

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
                    const { ip, port, account } = message.content;
                    console.log('命令：', message);
                    switch (message.type) {
                        case 'command':
                            if (message.content === 'sk') {
                                message.content = 'skills';
                            }
                            this.telnet?.sendData(message.content);
                            break;
                        case 'connect':
                            // 连接服务器
                            this.telnet = await this.telnetToServe(ip, port, wvPanel);
                            break;
                        case 'save':
                            this.files.writeFile(document, message.content);
                            break;
                        case 'getAccount':
                            this.files = new Files(this.context);
                            this.fileContent = await this.files.openFile(document);
                            wvPanel.webview.postMessage({ type: 'getConfig', datas: this.fileContent });
                            break;
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

    private async telnetToServe(ip: string, port: number, wvPanel: vscode.WebviewPanel): Promise<any> {
        const client = new TelnetClient(ip, port);
        try {
            // 连接到服务器
            await client.connect();
            client.onData((data) => {
                // console.log('mud数据：', data.toString());
                wvPanel.webview.postMessage({ type: 'mud', datas: data.toString() });
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

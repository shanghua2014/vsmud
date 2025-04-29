import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs'; // 使用 fs/promises 模块
import { TelnetClient } from './telnetClient';
import { CreateConfig } from './createConfig';

// 判断环境
const isDevelopment = process.env.NODE_ENV === 'development ';
console.log('当前环境:', isDevelopment ? '开发环境' : '生产环境');

class createHtml implements vscode.CustomTextEditorProvider {
    private extUri: vscode.Uri;
    private context: vscode.ExtensionContext;
    private configFile: any;

    constructor(extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
        this.extUri = extensionUri;
        this.context = context;
        this.configFile = new CreateConfig();
    }

    // 父类的 resolveCustomTextEditor 接口，用于创建自定义文本编辑器
    async resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, _token: vscode.CancellationToken): Promise<void> {
        try {
            // 缩短变量名
            const wvPanel = webviewPanel;
            wvPanel.webview.options = {
                enableScripts: true // 允许 Webview 执行脚本
            };
            let jsPath;
            let cssPath;
            // const htmlPath = path.join(this.extUri.fsPath, 'vsmud_vue/dev/index.html');
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

            // 设置 Webview 的 HTML 内容
            // const scriptUri = wvPanel.webview.asWebviewUri(vscode.Uri.file(jsPath));
            // const linkUri = wvPanel.webview.asWebviewUri(vscode.Uri.file(cssPath));
            // wvPanel.webview.html = this.getHTML({ js: scriptUri, css: linkUri });

            // 监听来自 Vue 应用的消息
            wvPanel.webview.onDidReceiveMessage(
                (message) => {
                    switch (message.type) {
                        case 'command':
                            // telnet.sendData(message.content);
                            break;
                        case 'config':
                            console.log('创建配置数据:', message.content);
                            this.configFile.createConfig(message.content);
                            // this.connectToServer(wvPanel, message.content.ip, message.content.port);
                            break;
                        case 'delete':
                            console.log('删除配置数据:', message.content);
                            this.configFile.deleteConfig(message.content.account);
                            break;
                        case 'getConfig':
                            console.log('获取配置数据');
                            this.configFile.getConfig().then((configs: any) => {
                                wvPanel.webview.postMessage({ type: 'getConfig', data: configs });
                            });
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

    private connectToServer(webviewPanel: vscode.WebviewPanel, serverIp?: string, serverPort?: number) {
        // 添加默认值或检查参数是否有效
        const ip = serverIp || '0.0.0.0'; // 提供默认 IP 地址
        const port = serverPort || 666; // 提供默认端口

        const telnet = new TelnetClient(ip, port);
        telnet
            .connect()
            .then(() => {
                telnet.onData((muddata) => {
                    webviewPanel.webview.postMessage({ type: 'mud', data: muddata });
                });
            })
            .catch((err) => {
                vscode.window.showErrorMessage('Telnet connection failed: ' + err.message);
            });

        // 监听 Webview 被销毁的事件
        webviewPanel.onDidDispose(
            () => {
                telnet.disconnect(); // 断开 Telnet 连接
            },
            null,
            this.context.subscriptions
        );

        return telnet;
    }

    private getHTML(ipmorts: { js?: string; css?: string }): string {
        let html = `
        <!DOCTYPE html>
            <html lang="en" class="dark">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>VSMUD客户端</title>
                <style>${ipmorts.css}</style>
                <script>window.customParent = acquireVsCodeApi();</script>
            </head>
            <body>
                <div id="app"></div>
                <script>${ipmorts.js}</script>
            </body>
        </html>`;
        return html;
    }
}
export { createHtml };

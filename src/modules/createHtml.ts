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
    private configCotent: object = {};
    private telnet: TelnetClient | undefined;

    constructor(extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
        this.extUri = extensionUri;
        this.context = context;
        this.configFile = new CreateConfig();
        this.configFile.activate(context).then((configCotent: object) => {
            this.configCotent = configCotent;
        });
    }

    // 父类的 resolveCustomTextEditor 接口，用于创建自定义文本编辑器
    async resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, _token: vscode.CancellationToken): Promise<void> {
        try {
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
                (message) => {
                    console.log('vscode：来自Vue消息:', message);
                    const { headerTitle, server, port, account, password, name } = message.content;
                    switch (message.type) {
                        case 'command':
                            // this.telnet && this.telnet.sendData(message.content);
                            // 打开对应的 .shtml 文件
                            break;
                        case 'connect':
                            // this.connectToServer(wvPanel, server, port).then((telnet) => {
                            //     this.telnet = telnet;
                            // });
                            break;
                        case 'config':
                            this.configFile.writeFile(message.content);
                            break;
                        case 'getConfig':
                            console.log('获取配置数据', this.configCotent);
                            wvPanel.webview.postMessage({ type: 'getConfig', datas: this.configCotent });
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
        return new Promise<TelnetClient>((resolve, reject) => {
            // 添加默认值或检查参数是否有效
            const ip = serverIp || '0.0.0.0'; // 提供默认 IP 地址
            const port = serverPort || 666; // 提供默认端口

            const telnet = new TelnetClient(ip, port);
            telnet
                .connect()
                .then(() => {
                    telnet.onData((muddata) => {
                        webviewPanel.webview.postMessage({ type: 'mud', data: muddata });
                        resolve(telnet);
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
        });
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

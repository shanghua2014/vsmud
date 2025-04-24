import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs'; // 使用 fs/promises 模块
import { Buffer } from 'buffer';

// 判断环境
const isDevelopment = process.env.NODE_ENV === 'development ';
console.log('当前环境:', isDevelopment ? '开发环境' : '生产环境');

class createHtml implements vscode.CustomTextEditorProvider {
    private extensionUri: vscode.Uri;
    private context: vscode.ExtensionContext;
    private configDatas: any;
    private webviewPanel: vscode.WebviewPanel | undefined;

    constructor(extensionUri: vscode.Uri, context: vscode.ExtensionContext, configDatas: any) {
        this.extensionUri = extensionUri;
        this.context = context;
        this.configDatas = configDatas;
    }

    // 父类的 resolveCustomTextEditor 接口，用于创建自定义文本编辑器
    async resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, _token: vscode.CancellationToken): Promise<void> {
        try {
            webviewPanel.webview.options = {
                enableScripts: true // 允许 Webview 执行脚本
            };
            let jsPath;
            let cssPath;
            const htmlPath = path.join(this.extensionUri.fsPath, 'vsmud_vue/dev/index.html');
            if (isDevelopment) {
                // 开发环境使用本地调试路径
                jsPath = path.join(this.extensionUri.fsPath, 'vsmud_vue/dev/js/main.js');
                cssPath = path.join(this.extensionUri.fsPath, 'vsmud_vue/dev/css/main.css');
            } else {
                jsPath = path.join(this.extensionUri.fsPath, 'vsmud_vue/dist/main.js');
                cssPath = path.join(this.extensionUri.fsPath, 'vsmud_vue/dist/main.css');
            }

            // 使用 fs 模块读取文件内容
            const jsContent = await fs.readFile(jsPath, 'utf8');
            const cssContent = await fs.readFile(cssPath, 'utf8');

            const scriptUri = webviewPanel.webview.asWebviewUri(vscode.Uri.file(jsPath));
            const linkUri = webviewPanel.webview.asWebviewUri(vscode.Uri.file(cssPath));
            // console.log('路径：', webviewPanel.webview.asWebviewUri(vscode.Uri.file(jsPath)).toString());

            // 将 js 和 css 路径转换为 VS Code Webview 的绝对路径
            // const jsUri = webviewPanel.webview.asWebviewUri(vscode.Uri.file(jsPath));
            // const cssUri = webviewPanel.webview.asWebviewUri(vscode.Uri.file(cssPath));

            // 设置 Webview 的 HTML 内容
            webviewPanel.webview.html = this.getHTML({ js: scriptUri, css: linkUri });

            // 监听来自 Vue 应用的消息
            webviewPanel.webview.onDidReceiveMessage(
                (message) => {
                    switch (message.type) {
                        case 'alert':
                            console.log('webview说：Vue消息-', this.configDatas);
                            webviewPanel.webview.postMessage({ type: 'alert', data: this.configDatas });
                            break;
                        case 'fromExtension':
                            // 转发 iframe 消息给 Vue
                            console.log('webview说：iframe消息-', message);
                            webviewPanel.webview.postMessage({ type: 'fromExtension', data: this.configDatas });
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

    /**
     * 从某个HTML文件读取能被Webview加载的HTML内容
     * @param {*} context 上下文
     * @param {*} templatePath 相对于插件根目录的html文件相对路径
     */

    /**
     * 生成 Webview 的 HTML 内容
     * @param webviewPanel - VS Code Webview 面板实例
     * @param ipmort - 包含不同环境所需资源的对象
     * @param ipmort.js - 生产环境使用的 JavaScript 代码字符串
     * @param ipmort.css - 可选的生产环境 CSS 内容
     * @returns 返回完整的 HTML 字符串
     */
    private getHTML(ipmorts: { js?: vscode.Uri; css?: vscode.Uri }): string {
        let html = `
        <!DOCTYPE html>
            <html lang="en" class="dark">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>VSMUD客户端</title>
                <link rel="stylesheet" href="${ipmorts.css}">
            </head>
            <body>
                <div id="app"></div>
                <script>window.parent = acquireVsCodeApi();</script>
                <script src="${ipmorts.js}"></script>
            </body>
        </html>`;
        return html;
    }
}
export { createHtml };

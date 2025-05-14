import * as vscode from 'vscode';
import * as path from 'path';
import * as vm from 'vm';
import { promises as fs } from 'fs'; // 使用 fs/promises 模块
import { TelnetClient } from './telnetClient';
import { Files } from './files';
import { Triggers } from '../../script/trigger'; // 导入 Triggers 函数
import { handleError, stripAnsi } from '../tools/utils';
import { Commands } from './commands';

/**
 * 定义一个接口，用于描述消息的结构
 * 该接口包含一个 content 属性，用于存储消息的内容
 */

// 判断环境
console.log('当前环境:', process.env.NODE_ENV);
const isDevelopment = process.env.NODE_ENV === 'development';
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
    private document: vscode.TextDocument;
    private commands: any;

    constructor(extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
        this.extUri = extensionUri;
        this.context = context;
        this.fileContent = '';
        this.triggers = Triggers();
        this.files = new Files(context);
        this.document = '' as any;
        this.commands = new Commands();
    }

    /**
     * 重新加载触发器配置
     * 该方法会读取触发器脚本文件，执行脚本并更新当前的触发器配置
     * @returns 重新加载成功返回 true，出现错误返回 null
     */
    private async reloadTriggers(): Promise<boolean | null> {
        // 构建触发器脚本文件的路径
        const targetPath = path.join(__dirname, '../../vsmud/script/trigger.js');

        // 异步读取触发器脚本文件内容
        const [code, err] = await handleError(fs.readFile(targetPath, 'utf8'));
        // 若读取过程中出现错误，返回 null
        if (err) {
            return null;
        }

        // 初始化一个模拟的 Node.js 模块对象，用于执行脚本时存储导出内容
        const module: { exports: { Triggers: () => any } } = { exports: { Triggers: () => [] } };
        // 创建一个 vm.Script 实例，用于后续在隔离环境中执行脚本
        const script = new vm.Script(code!);
        // 创建一个上下文对象，模拟 Node.js 环境，包含 module、require 和 exports
        const context = vm.createContext({ module, require, exports: module.exports });
        // 在创建的上下文中执行脚本
        script.runInContext(context);
        // 从模块导出中获取更新后的触发器配置并赋值给类的 triggers 属性
        this.triggers = module.exports.Triggers();
        // 打印重新加载成功的日志以及更新后的触发器配置
        // console.log('Triggers 已重新加载', this.triggers);

        // 重新加载成功，返回 true
        return true;
    }

    private messageHandlers: { [key: string]: (message: any, document: vscode.TextDocument, wvPanel: vscode.WebviewPanel) => Promise<void> | void } = {
        // 发送命令
        // command: async (message) => {
        //     if (/^#[a-z]{2}/.test(message.content)) {
        //         if (message.content === '#reload' || message.content === '#re') {
        //             await this.files.copyFile(this.document);
        //             await this.reloadTriggers();
        //         }
        //     } else {
        //         this.telnet?.sendData(message.content);
        //     }
        // },
        // 执行命令
        command: async (message: any, document: vscode.TextDocument, wvPanel: vscode.WebviewPanel) => {
            await this.commands.command({
                message: message,
                files: this.files,
                telnet: this.telnet,
                reload: () => {
                    this.reloadTriggers();
                },
                reconnect: () => {
                    this.telnetToServe(message.content.ip, message.content.port, wvPanel);
                }
            });
        },
        // 连接mud服务器
        connect: async (message, document, wvPanel) => {
            const { ip, port } = message.content;
            this.telnet = await this.telnetToServe(ip, port, wvPanel);
        },
        // 保存登录信息
        saveAccount: async (message, document, wvPanel) => {
            this.files.writeFile(document, message.content);
        },
        // 获取登录信息
        getAccount: async (message, document, wvPanel) => {
            this.fileContent = await this.files.openFile(document);
            wvPanel.webview.postMessage({ type: 'getConfig', datas: this.fileContent });
        }
    };

    /**
     * 获取环境路径
     * @param fileName 文件名
     * @returns 文件路径
     */
    private getEnv(fileName: string): string {
        return isDevelopment ? path.join(this.extUri.fsPath, 'vsmud_vue/dev', fileName) : path.join(this.extUri.fsPath, 'vsmud_vue/dist', fileName);
    }

    /**
     * 解析自定义文本编辑器
     * @param document 文本文档
     * @param webviewPanel Webview 面板
     * @param _token 取消令牌
     */
    async resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, _token: vscode.CancellationToken): Promise<void> {
        const wvPanel = webviewPanel;
        wvPanel.webview.options = { enableScripts: true };
        this.document = document;

        // 加载 JS 和 CSS 文件内容
        const [jsContent, jsErr] = await handleError(fs.readFile(this.getEnv('js/main.js'), 'utf8'));
        const [cssContent, cssErr] = await handleError(fs.readFile(this.getEnv('css/main.css'), 'utf8'));

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
     * 连接到 Telnet 服务器
     * @param ip - Telnet 服务器的 IP 地址
     * @param port - Telnet 服务器的端口号
     * @param wvPanel - 用于显示信息的 Webview 面板
     * @returns 一个已连接的 Telnet 客户端实例
     */
    private async telnetToServe(ip: string, port: number, wvPanel: vscode.WebviewPanel): Promise<TelnetClient> {
        // 创建一个 Telnet 客户端实例，传入服务器 IP 地址和端口号
        const client = new TelnetClient(ip, port);
        await client.connect();
        // 监听 Telnet 客户端接收到的数据事件
        client.onData(async (data) => {
            // 打印接收到的 MUD 数据
            console.log('mud数据：', data);
            const normalStr = stripAnsi(data);
            // 将接收到的 MUD 数据发送到 Webview 面板
            wvPanel.webview.postMessage({ type: 'mud', datas: data });
            for (const tri of this.triggers) {
                // 根据触发器的正则表达式创建一个正则对象
                const reg = new RegExp(tri.reg);
                // 检查接收到的数据是否匹配触发器的正则表达式
                if (reg.test(normalStr)) {
                    let cmd: any = '';
                    if (tri.cmd) {
                        cmd = `${tri.cmd}`;
                    }
                    if (tri.onSuccess) {
                        cmd = `${tri.onSuccess()}`;
                    }
                    cmd += '\r\n';
                    wvPanel.webview.postMessage({ type: 'cmd', datas: cmd });
                }
            }
        });

        // 监听 Webview 面板关闭事件，当面板关闭时断开 Telnet 连接
        wvPanel.onDidDispose(() => client.disconnect(), null, this.context.subscriptions);

        // 返回已连接的 Telnet 客户端实例
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

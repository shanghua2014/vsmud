import * as vscode from 'vscode';
import { createHtml } from './modules/createHtml';

export function activate(context: vscode.ExtensionContext) {
    const provider = new createHtml(context.extensionUri, context);
    context.subscriptions.push(
        // 注册命令：同package.json中配置的 contributes.customEditors[0].viewType 字段
        vscode.window.registerCustomEditorProvider('vsmudClient', provider, {
            webviewOptions: {
                enableScripts: true, // 允许 Webview 执行脚本
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')], // 指定本地资源根目录
                enableCommandUris: true, // 允许使用 vscode://command 协议的 URI
                enableFindWidget: true, // 显示查找小部件
                retainContextWhenHidden: false // 隐藏时保留上下文
            } as vscode.WebviewOptions & vscode.WebviewPanelOptions // 类型断言
        })
    );
}

// This method is called when your extension is deactivated
export function deactivate() {}

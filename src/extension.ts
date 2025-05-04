import * as vscode from 'vscode';
import { createHtml } from './modules/createHtml';

let disposable: vscode.Disposable;
let htmlProvider: InstanceType<typeof createHtml> | null = null;

export function activate(context: vscode.ExtensionContext) {
    htmlProvider = new createHtml(context.extensionUri, context);
    // 注册命令：同package.json中配置的 contributes.customEditors[0].viewType 字段
    disposable = vscode.window.registerCustomEditorProvider('vsmudClient', htmlProvider, {
        webviewOptions: {
            enableScripts: true, // 允许 Webview 执行脚本
            enableCommandUris: true, // 允许使用 vscode://command 协议的 URI
            enableFindWidget: true, // 显示查找小部件
            retainContextWhenHidden: true, // 隐藏时保留上下文
            enableClipboardSupport: true // 启用剪贴板支持，允许复制和粘贴
        } as vscode.WebviewOptions & vscode.WebviewPanelOptions // 类型断言
    });

    context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {
    if (disposable) {
        // 释放资源
        disposable.dispose();
    }
}

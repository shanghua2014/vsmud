import * as vscode from 'vscode';
import { createHtml } from './modules/createHtml';

export function activate(context: vscode.ExtensionContext) {
    const provider = new createHtml(context.extensionUri, context);
    context.subscriptions.push(
        // 注册命令：同package.json中配置的 contributes.customEditors[0].viewType 字段
        vscode.window.registerCustomEditorProvider('vsmudClient', provider, {
            webviewOptions: {
                retainContextWhenHidden: true
            }
        })
    );
}

// This method is called when your extension is deactivated
export function deactivate() {}

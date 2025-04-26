import * as vscode from 'vscode';
import { createConfig } from './modules/createConfig';
import { createHtml } from './modules/createHtml';

export function activate(context: vscode.ExtensionContext) {
    createConfig().then((result) => {
        const r = result;
        console.log(r);
        if (r.isCreate || r.isHasConfig) {
            // 注册自定义文本编辑器
            const provider = new createHtml(context.extensionUri, context, r.datas ? r.datas : '');
            context.subscriptions.push(
                // 注册命令：同package.json中配置的 contributes.customEditors[0].viewType 字段
                vscode.window.registerCustomEditorProvider('vsmudClient', provider, {
                    webviewOptions: {
                        retainContextWhenHidden: true
                    }
                })
            );
        } else {
            vscode.window.showErrorMessage('配置文件创建中，请稍后再试！');
        }
    });
}

// This method is called when your extension is deactivated
export function deactivate() {}

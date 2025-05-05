import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs';

export class Files {
    private fname: any;
    public fileContent: any;

    constructor(context: vscode.ExtensionContext) {
        const disposable = vscode.workspace.onDidOpenTextDocument(async (document) => {
            if (document.fileName.endsWith('.vmud')) {
                this.fileContent = await this.openFile(document);
            }
        });
        context.subscriptions.push(disposable);
    }

    public async openFile(document: vscode.TextDocument) {
        if (document.languageId === 'vmud') {
            const file = document.fileName.split('\\');
            this.fname = file[file.length - 1].split('.')[0];

            // 获取工作区根目录，缩短变量名
            const wsFolders = vscode.workspace.workspaceFolders;
            if (!wsFolders) {
                vscode.window.showWarningMessage('未打开工作区，无法创建目录。');
                return;
            }
            const workspaceRoot = wsFolders[0].uri.fsPath;

            // 调用封装方法创建目录和文件
            await this.findAndMake(workspaceRoot, 'logs');
            return await this.findAndMake(workspaceRoot, this.fname, document);
        } else {
            console.log(`非 .vmud 文件已打开: ${document.fileName}`);
        }
    }

    private async findAndMake(workspaceRoot: string, dirName: string, document?: vscode.TextDocument): Promise<any> {
        const targetDirPath = path.join(workspaceRoot, dirName);
        try {
            await fs.access(targetDirPath);
        } catch {
            await fs.mkdir(targetDirPath, { recursive: true });
        }

        const triggerFilePath = path.join(targetDirPath, 'trigger.js');
        // 检查 trigger.js 文件是否存在
        if (document) {
            try {
                await fs.access(triggerFilePath);
            } catch {
                console.log('trigger 文件不存在，创建文件');
                const triggerContent = `
export const Triggers = {
    this.action.push({
        trigger:'',
        name:'',
        patterns:'',
        onSuccess:()=>{
            console.log('触发成功'); 
        }
    })
} `;
                await fs.writeFile(triggerFilePath, triggerContent, 'utf8');
            }

            // 检查 alias.js 文件是否存在
            const aliasFilePath = path.join(targetDirPath, 'alias.js');
            try {
                await fs.access(aliasFilePath);
            } catch {
                console.log('alias 文件不存在，创建文件');
                await fs.writeFile(aliasFilePath, '{}', 'utf8');
            }

            // 检查 config.json 文件是否存在
            const configFilePath = path.join(targetDirPath, 'config.json');
            try {
                await fs.access(configFilePath);
                // 获取文件内容并返回
                const fileContent = await fs.readFile(configFilePath, 'utf8');
                // console.log('config 文件内容：', fileContent);
                return fileContent;
            } catch {
                console.log('config 文件不存在，创建文件');
                const fielContent = JSON.stringify({ account: dirName });
                await fs.writeFile(configFilePath, fielContent, 'utf8');
                return fielContent;
            }
        }
    }

    public async writeFile(document: vscode.TextDocument, content: object) {
        try {
            // 获取工作区根目录
            const wsFolders = vscode.workspace.workspaceFolders;
            if (!wsFolders) {
                console.log('未打开工作区，无法写入文件内容。');
                return false;
            }
            const workspaceRoot = wsFolders[0].uri.fsPath;

            if (!this.fname) {
                const file = document.fileName.split('\\');
                this.fname = file[file.length - 1].split('.')[0];
            }

            // 拼接 config.json 文件路径
            console.log(workspaceRoot);
            console.log(this.fname);
            const configFilePath = path.join(workspaceRoot, this.fname, 'config.json');

            // 将内容转换为格式化的 JSON 字符串并写入文件
            const jsonContent = JSON.stringify(content);
            await fs.writeFile(configFilePath, jsonContent);

            return true;
        } catch (error) {
            console.error(`写入文件内容出错: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }
}

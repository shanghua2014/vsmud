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
        try {
            await fs.access(triggerFilePath);
        } catch {
            console.log('trigger 文件不存在，创建文件');
            const triggerContent = `
export const Triggers = () => {
    // 自定义一个数组，用于存储触发器
    const t = [];
    t.push({
        name: 'name',
        reg: '触发内容',
        group: 'group',
        onSuccess: ()=>{
            return 'look';
        }
    });
    t.push({
        name: 'name',
        reg: '触发内容',
        group: 'group',
        cmd: 'look'
    });
    return t;
}`;
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

    public async copyFile(document: vscode.TextDocument) {
        return new Promise(async (resolve, reject) => {
            if (document.languageId !== 'vmud') {
                console.log(`非 .vmud 文件，无法复制: ${document.fileName}`);
                return;
            }

            const wsFolders = vscode.workspace.workspaceFolders;
            if (!wsFolders) {
                vscode.window.showWarningMessage('未打开工作区，无法复制文件。');
                return;
            }

            const workspaceRoot = wsFolders[0].uri.fsPath;
            const file = document.fileName.split('\\');
            const fileName = file[file.length - 1].split('.')[0];

            const sourceDir = path.join(workspaceRoot, fileName);
            const targetDir = path.join(__dirname, '../../vsmud/script');

            try {
                // 读取源目录下的所有文件和文件夹
                const entries = await fs.readdir(sourceDir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isFile()) {
                        const sourcePath = path.join(sourceDir, entry.name);
                        const targetPath = path.join(targetDir, entry.name);
                        fs.access(sourcePath).then(async () => {
                            if (entry.name.endsWith('.js')) {
                                try {
                                    // fs.copyFile(sourcePath, targetPath);
                                    console.log(`${entry.name} 复写成功`);
                                    const fileContent = await fs.readFile(sourcePath, 'utf8');
                                    await fs.writeFile(targetPath, fileContent);
                                    resolve(true);
                                } catch (error) {
                                    console.error(`复制 ${entry.name} 失败: ${error instanceof Error ? error.message : String(error)}`);
                                }
                            }
                        });
                    }
                }
            } catch (error) {
                console.error(`读取源目录失败: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }
}

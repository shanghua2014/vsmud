import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs'; // 使用 fs/promises 模块

export class CreateConfig {
    private openedFile: any;

    constructor() {
        this.openedFile = '';
    }

    // 激活扩展时执行的异步方法
    async activate(context: vscode.ExtensionContext) {
        return new Promise<void>((resolve, reject) => {
            // 监听文件打开事件
            const disposable = vscode.workspace.onDidOpenTextDocument(async (document) => {
                if (document.fileName.endsWith('.vmud')) {
                    this.openedFile = document.fileName.split('\\');
                    this.openedFile = this.openedFile[this.openedFile.length - 1].split('.')[0];

                    try {
                        // 获取工作区根目录，缩短变量名
                        const wsFolders = vscode.workspace.workspaceFolders;
                        if (!wsFolders) {
                            vscode.window.showWarningMessage('未打开工作区，无法创建目录。');
                            return;
                        }
                        const workspaceRoot = wsFolders[0].uri.fsPath;

                        // 调用封装方法创建目录和文件
                        await this.getFiles(workspaceRoot, 'logs');
                        const content = this.getFiles(workspaceRoot, this.openedFile);
                        resolve(content);
                    } catch (error) {
                        vscode.window.showErrorMessage(`操作出错: ${error instanceof Error ? error.message : String(error)}`);
                    }
                } else {
                    console.log(`非 .vmud 文件已打开: ${document.fileName}`);
                }
            });
            context.subscriptions.push(disposable);
        });
    }

    /**
     * 创建目标目录和其下的 config.json 文件
     * @param workspaceRoot 工作区根目录路径
     * @param dirName 目标目录名
     * @returns 若 config.json 文件已存在，返回其内容；否则返回 null
     */
    public async getFiles(workspaceRoot: string, dirName: string): Promise<any> {
        const targetDirPath = path.join(workspaceRoot, dirName);

        // 检查目录是否存在，不存在则创建
        try {
            await fs.access(targetDirPath);
        } catch {
            await fs.mkdir(targetDirPath, { recursive: true });
        }

        // 如果目录是 this.openedFile 对应的目录，创建或读取 config.json
        if (dirName === this.openedFile) {
            const configFilePath = path.join(targetDirPath, 'config.json');
            try {
                // 检查 config.json 文件是否存在
                await fs.access(configFilePath);
                // 读取文件内容
                const fileContent = await fs.readFile(configFilePath, 'utf8');
                // 解析 JSON 内容
                return JSON.parse(fileContent);
            } catch {
                // 文件不存在，创建新的 config.json 文件
                await fs.writeFile(configFilePath, '{}', 'utf8');
                return '{}';
            }
        }

        return null;
    }

    public async writeFile(content: object) {
        try {
            // 获取工作区根目录
            const wsFolders = vscode.workspace.workspaceFolders;
            if (!wsFolders) {
                console.log('未打开工作区，无法写入文件内容。');
                return false;
            }
            const workspaceRoot = wsFolders[0].uri.fsPath;

            // 拼接 config.json 文件路径
            const configFilePath = path.join(workspaceRoot, this.openedFile, 'config.json');

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

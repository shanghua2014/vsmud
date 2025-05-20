import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs';
import { handleError } from '../tools/utils'; // 引入 handleError 函数
import { ScriptManager } from './scriptManager'; // 引入 ScriptManager 类

/**
 * 文件操作类，用于处理与文件相关的创建、读写和复制操作
 */
export class Files {
    private fname: string | null = null; // 当前操作的文件名
    private fileContent: object | any = null; // 文件内容缓存
    private scriptManager: ScriptManager; // 脚本管理实例

    constructor(context: vscode.ExtensionContext) {
        this.scriptManager = new ScriptManager(); // 初始化脚本管理实例
        // 监听打开的文本文档，当打开 .vmud 文件时，加载文件内容
        const disposable = vscode.workspace.onDidOpenTextDocument(async (document) => {
            if (document.fileName.endsWith('.vmud')) {
                this.fileContent = await this.openFile(document);
            }
        });
        context.subscriptions.push(disposable);
    }

    /**
     * 打开并加载 .vmud 文件
     * @param document 要打开的文本文档
     * @returns 文件内容
     */
    public async openFile(document: vscode.TextDocument): Promise<any> {
        if (document.languageId === 'vmud') {
            this.fname = path.basename(document.fileName, '.vmud'); // 获取文件名（不带扩展名）
            const workspaceRoot = this.getWorkspaceRoot(); // 获取工作区根目录
            if (!workspaceRoot) {
                return;
            }

            return await this.findAndMake(workspaceRoot, this.fname, document); // 查找或创建相关文件
        }
        console.log(`非 .vmud 文件已打开: ${document.fileName}`);
    }

    /**
     * 查找或创建相关文件
     * @param workspaceRoot 工作区根目录
     * @param dirName 文件夹名称
     * @param document 文本文档（可选）
     * @returns 文件内容
     */
    private async findAndMake(workspaceRoot: string, dirName: string, document?: vscode.TextDocument): Promise<any> {
        const targetDirPath = path.join(workspaceRoot, dirName); // 构建目标目录路径
        await this.ensureDirectoryExists(targetDirPath); // 确保目标目录存在

        // 定义需要创建的文件列表
        const filesToCreate = [
            { name: 'trigger.js', content: this.scriptManager.triggers() }, // 触发器脚本文件
            { name: 'alias.js', content: this.scriptManager.alias() }, // 别名脚本文件
            { name: 'config.json', content: JSON.stringify({ account: dirName }) } // 配置文件
        ];

        // 遍历文件列表，创建或更新文件
        for (const file of filesToCreate) {
            const filePath = path.join(targetDirPath, file.name); // 构建文件路径
            // const gitFilePath = path.join(targetDirPath, file.name + '.git'); // 构建 .git 文件路径，不创建.git 打开文件会报错
            await this.ensureFileExists(filePath, file.content); // 确保文件存在并写入内容
            // await this.ensureFileExists(gitFilePath, ''); // 创建空的 .git 文件
        }

        const configFilePath = path.join(targetDirPath, 'config.json'); // 构建配置文件路径
        return await this.readFile(configFilePath); // 读取并返回配置文件内容
    }

    /**
     * 确保目录存在，如果不存在则创建
     * @param dirPath 目录路径
     */
    private async ensureDirectoryExists(dirPath: string): Promise<void> {
        const [_, err] = await handleError(fs.mkdir(dirPath, { recursive: true }));
        if (err) {
            console.error(`创建目录失败: ${err.message}`);
        }
    }

    /**
     * 确保文件存在，如果不存在则创建并写入默认内容
     * @param filePath 文件路径
     * @param content 默认内容
     */
    private async ensureFileExists(filePath: string, content: string): Promise<void> {
        const [_, err] = await handleError(fs.access(filePath));
        if (err) {
            const [writeResult, writeErr] = await handleError(fs.writeFile(filePath, content, 'utf8'));
            if (writeErr) {
                console.error(`写入文件失败: ${writeErr.message}`);
            }
        }
    }

    /**
     * 读取文件内容
     * @param filePath 文件路径
     * @returns 文件内容
     */
    private async readFile(filePath: string): Promise<string> {
        const [content, err] = await handleError(fs.readFile(filePath, 'utf8'));
        if (err) {
            console.error(`读取文件失败: ${err.message}`);
        }
        return content || '';
    }

    /**
     * 写入文件内容
     * @param document 文本文档
     * @param content 要写入的内容
     * @returns 是否成功写入
     */
    public async writeFile(document: vscode.TextDocument, content: object): Promise<boolean> {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot || !this.fname) {
            return false;
        }

        const configFilePath = path.join(workspaceRoot, this.fname, 'config.json');
        const jsonContent = JSON.stringify(content);
        const [_, err] = await handleError(fs.writeFile(configFilePath, jsonContent));
        if (err) {
            console.error(`写入文件内容出错: ${err.message}`);
            return false;
        }
        return true;
    }

    /**
     * 复制文件
     * @param document 文本文档
     * @returns 是否成功复制
     */
    public async copyFile(document: vscode.TextDocument): Promise<boolean> {
        if (document.languageId !== 'vmud') {
            return false;
        }

        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) {
            return false;
        }

        this.fname = path.basename(document.fileName, '.vmud');
        const sourceDir = path.join(workspaceRoot, this.fname);
        const targetDir = path.join(__dirname, '../../vsmud/script');

        const [entries, err] = await handleError(fs.readdir(sourceDir, { withFileTypes: true }));
        if (err || !entries) {
            return false;
        }

        let success = false;
        for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith('.js')) {
                const sourcePath = path.join(sourceDir, entry.name);
                let targetPath: string;
                // 检查文件名是否包含 trigger 或 alias

                targetPath = path.join(targetDir, entry.name);

                // 查找并删除目标目录中包含指定文件名的文件
                const filesToDelete = await this.findFiles(targetDir, entry.name);
                // 执行删除操作
                for (const filePath of filesToDelete) {
                    await handleError(fs.unlink(filePath));
                    console.log(`已删除目标文件: ${path.basename(filePath)}`);
                }

                const [content, readErr] = await handleError(fs.readFile(sourcePath, 'utf8'));
                if (readErr || content === null) {
                    continue;
                }

                const [_, writeErr] = await handleError(fs.writeFile(targetPath, content));
                if (writeErr) {
                    continue;
                }

                console.log(`${path.basename(targetPath)} 复制成功`);
                success = true;
            }
        }

        return success;
    }

    /**

     * 查找目标目录中包含指定文件名的文件
     * @param targetDir 目标目录路径


     * @param fileName 指定的文件名（可包含扩展名）
     * @returns 包含指定文件名的文件路径数组
     */

    private async findFiles(targetDir: string, fileName: string): Promise<string[]> {
        const filesToDelete: string[] = [];
        const [targetEntries, targetErr] = await handleError(fs.readdir(targetDir, { withFileTypes: true }));
        if (!targetErr && targetEntries) {
            for (const targetEntry of targetEntries) {
                if (targetEntry.isFile() && targetEntry.name.endsWith(fileName)) {
                    const filePath = path.join(targetDir, targetEntry.name);
                    filesToDelete.push(filePath);
                }
            }
        }
        return filesToDelete;
    }

    /**
     * 获取工作区根目录
     * @returns 工作区根目录路径或 null
     */
    private getWorkspaceRoot(): string | null {
        const wsFolders = vscode.workspace.workspaceFolders;
        if (!wsFolders) {
            vscode.window.showWarningMessage('未打开工作区，无法操作文件。');
            return null;
        }
        return wsFolders[0].uri.fsPath;
    }
}

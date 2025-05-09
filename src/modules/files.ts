import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs';
import { handleError } from '../tools/utils'; // 引入 handleError 函数

/**
 * 文件操作类，用于处理与文件相关的创建、读写和复制操作
 */
export class Files {
    private fname: any;
    public fileContent: any;

    /**
     * 构造函数，初始化文件操作类
     * @param context - VS Code 扩展上下文
     */
    constructor(context: vscode.ExtensionContext) {
        const disposable = vscode.workspace.onDidOpenTextDocument(async (document) => {
            if (document.fileName.endsWith('.vmud')) {
                this.fileContent = await this.openFile(document);
            }
        });
        context.subscriptions.push(disposable);
    }

    /**
     * 打开文件并初始化文件内容
     * @param document - 要打开的文本文档
     * @returns 返回文件内容或空值
     */
    public async openFile(document: vscode.TextDocument) {
        if (document.languageId === 'vmud') {
            const file = document.fileName.split('\\');
            this.fname = file[file.length - 1].split('.')[0];

            // 获取工作区根目录
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

    /**
     * 查找目录，如果不存在则创建目录及配套文件
     * @param workspaceRoot - 工作区根路径
     * @param dirName - 目录名称
     * @param document - 可选参数，要操作的文本文档
     * @returns 返回配置文件内容或读取结果
     */
    private async findAndMake(workspaceRoot: string, dirName: string, document?: vscode.TextDocument): Promise<any> {
        const targetDirPath = path.join(workspaceRoot, dirName);

        // 使用 handleError 替代 try-catch
        const [accessResult, accessError] = await handleError(fs.access(targetDirPath));
        if (accessError) {
            const [mkdirResult, mkdirError] = await handleError(fs.mkdir(targetDirPath, { recursive: true }));
            if (mkdirError) {
                console.error(`创建目录失败: ${mkdirError.message}`);
                return;
            }
        }

        const triggerFilePath = path.join(targetDirPath, 'trigger.js');
        const [triggerAccessResult, triggerAccessError] = await handleError(fs.access(triggerFilePath));
        if (triggerAccessError) {
            console.log('trigger 文件不存在，创建文件');
            const triggerContent = `
module.exports = {
	Triggers: () => {
		const t = [];
		t.push({
			name: "哈哈",
			reg: "触发语句",
			group: "sys",
			onSuccess: () => {
				return "hehe";
			},
		});
		t.push({
			name: "触发器 name",
			reg: "触发器 action",
			group: "触发器 group",
			cmd: "look",
		});
		return t;
	},
}`;
            const [writeTriggerResult, writeTriggerError] = await handleError(fs.writeFile(triggerFilePath, triggerContent, 'utf8'));
            if (writeTriggerError) {
                console.error(`写入 trigger 文件失败: ${writeTriggerError.message}`);
                return;
            }
        }

        const aliasFilePath = path.join(targetDirPath, 'alias.js');
        const [aliasAccessResult, aliasAccessError] = await handleError(fs.access(aliasFilePath));
        if (aliasAccessError) {
            console.log('alias 文件不存在，创建文件');
            const [writeAliasResult, writeAliasError] = await handleError(fs.writeFile(aliasFilePath, '{}', 'utf8'));
            if (writeAliasError) {
                console.error(`写入 alias 文件失败: ${writeAliasError.message}`);
                return;
            }
        }

        const configFilePath = path.join(targetDirPath, 'config.json');
        const [configAccessResult, configAccessError] = await handleError(fs.access(configFilePath));
        if (configAccessError) {
            console.log('config 文件不存在，创建文件');
            const fileContent = JSON.stringify({ account: dirName });
            const [writeConfigResult, writeConfigError] = await handleError(fs.writeFile(configFilePath, fileContent, 'utf8'));
            if (writeConfigError) {
                console.error(`写入 config 文件失败: ${writeConfigError.message}`);
                return;
            }
            return fileContent;
        } else {
            const [readConfigResult, readConfigError] = await handleError(fs.readFile(configFilePath, 'utf8'));
            if (readConfigError) {
                console.error(`读取 config 文件失败: ${readConfigError.message}`);
                return;
            }
            return readConfigResult;
        }
    }

    /**
     * 写入文件内容
     * @param document - 要写入的文本文档
     * @param content - 要写入的内容对象
     * @returns 返回布尔值表示是否写入成功
     */
    public async writeFile(document: vscode.TextDocument, content: object) {
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

        const configFilePath = path.join(workspaceRoot, this.fname, 'config.json');
        const jsonContent = JSON.stringify(content);

        // 使用 handleError 替代 try-catch
        const [writeResult, writeError] = await handleError(fs.writeFile(configFilePath, jsonContent));
        if (writeError) {
            console.error(`写入文件内容出错: ${writeError.message}`);
            return false;
        }
        return true;
    }

    /**
     * 复制文件
     * @param document - 要复制的文本文档
     * @returns 返回一个Promise，解析为布尔值表示是否复制成功
     */
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

            // 使用 handleError 替代 try-catch
            const [readdirResult, readdirError] = await handleError(fs.readdir(sourceDir, { withFileTypes: true }));
            if (readdirError || !readdirResult) {
                console.error(`读取源目录失败: ${readdirError?.message}`);
                return;
            }

            for (const entry of readdirResult) {
                if (entry.isFile()) {
                    const sourcePath = path.join(sourceDir, entry.name);
                    const targetPath = path.join(targetDir, entry.name);

                    const [accessResult, accessError] = await handleError(fs.access(sourcePath));
                    if (accessError) {
                        continue;
                    }

                    if (entry.name.endsWith('.js')) {
                        const [readFileResult, readFileError] = await handleError(fs.readFile(sourcePath, 'utf8'));
                        if (readFileError || !readFileResult) {
                            console.error(`读取 ${entry.name} 失败: ${readFileError?.message}`);
                            continue;
                        }

                        const [writeFileResult, writeFileError] = await handleError(fs.writeFile(targetPath, readFileResult));
                        if (writeFileError) {
                            console.error(`写入 ${entry.name} 失败: ${writeFileError.message}`);
                            continue;
                        }

                        console.log(`${entry.name} 复写成功`);
                        resolve(true);
                    }
                }
            }
        });
    }
}

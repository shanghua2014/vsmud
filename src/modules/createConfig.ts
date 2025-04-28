/** @format */

import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs'; // 使用 fs/promises 模块

/**
 * 创建目录并在目录下创建 config.json 文件的返回参数类型
 */
interface createConfigParams {
    isCreate?: boolean;
    datas?: { account: string; pwd: string };
}

/**
 * 用于创建配置相关目录和文件的类
 */
export class CreateConfig {
    /**
     * 创建目录并在目录下创建 config.json 文件
     * @returns 包含创建结果和配置数据的 Promise
     */
    constructor() {}

    /**
     * 获取所有目录下的 config.json 文件内容，排除 logs 目录
     * @returns 包含所有 config.json 文件内容的数组
     */
    public async getConfig() {
        try {
            // 获取工作区根路径
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                console.log('未找到工作区目录');
                return [];
            }
            const rootPath = workspaceFolder.uri.fsPath;

            // 递归遍历目录，查找 config.json 文件
            const configFiles = await this.findConfigFiles(rootPath);

            // 读取所有 config.json 文件内容
            const configContents = await Promise.all(
                configFiles.map(async (filePath) => {
                    try {
                        const content = await fs.readFile(filePath, 'utf8');
                        return JSON.parse(content);
                    } catch (error) {
                        console.error(`读取文件 ${filePath} 出错:`, error);
                        return null;
                    }
                })
            );

            // 过滤掉读取失败的结果
            return configContents.filter((content) => content !== null);
        } catch (error) {
            console.error('获取 config.json 文件内容时出错:', error);
            return [];
        }
    }

    /**
     * 删除名为 account 的目录
     * @param account 要删除的目录名称
     */
    public async deleteConfig(account: string) {
        try {
            // 获取工作区根路径
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                console.log('未找到工作区目录，无法删除目录');
                return;
            }
            // 构建要删除的目录路径
            const rootPath = workspaceFolder.uri.fsPath;
            const dirPath = path.join(rootPath, account);

            // 递归删除目录及其内容
            await fs.rm(dirPath, { recursive: true, force: true });
            console.log(`目录 ${dirPath} 删除成功`);
        } catch (error) {
            console.error(`删除目录 ${account} 时出错:`, error);
        }
    }

    /**
     * 递归查找 config.json 文件，排除 logs 目录
     * @param dirPath 当前查找的目录路径
     * @returns 包含所有 config.json 文件路径的数组
     */
    private async findConfigFiles(dirPath: string): Promise<string[]> {
        let configFiles: string[] = [];
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const entryPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                if (entry.name.toLowerCase() === 'logs') {
                    continue; // 排除 logs 目录
                }
                const subConfigFiles = await this.findConfigFiles(entryPath);
                configFiles = configFiles.concat(subConfigFiles);
            } else if (entry.isFile() && entry.name === 'config.json') {
                configFiles.push(entryPath);
            }
        }

        return configFiles;
    }

    public async createConfig(content: any) {
        // 立即调用异步函数来处理文件和目录操作
        try {
            const { account } = content;
            console.log(account);
            // 使用 workspaceFolders 获取工作区根路径
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            const rootPath = workspaceFolder ? workspaceFolder.uri.fsPath : '';
            // 构建目录路径
            const dirPath = path.join(rootPath, account);

            // 检查目录是否存在
            try {
                await fs.stat(dirPath);
                console.log(`目录 ${dirPath} 已存在，程序停止执行`);
                return;
            } catch (statError: any) {
                // 若目录不存在，继续执行后续操作
                if (statError.code !== 'ENOENT') {
                    throw statError;
                }
            }

            // 目录不存在，创建目录
            await fs.mkdir(dirPath, { recursive: true });
            console.log(`目录 ${dirPath} 创建成功`);

            // 构建 .shtml 文件路径
            const shtmlFilePath = path.join(dirPath, `${account}.shtml`);
            // 创建 .shtml 文件
            await fs.writeFile(shtmlFilePath, '');
            console.log(`文件 ${shtmlFilePath} 创建成功`);

            // 构建 config.json 文件路径
            const configFilePath = path.join(dirPath, 'config.json');
            // 将 content 数据写入 config.json 文件
            await fs.writeFile(configFilePath, JSON.stringify(content, null, 2));
            console.log(`文件 ${configFilePath} 创建成功`);
        } catch (error) {
            console.error('创建目录和文件时出错:', error);
        }
    }
}

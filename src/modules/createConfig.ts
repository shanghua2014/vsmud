/** @format */

import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs'; // 使用 fs/promises 模块

/**
 * 用于创建配置相关目录和文件的类
 */
export class CreateConfig {
    // 全局变量，用于存储工作区文件夹信息
    private wsFolder: vscode.WorkspaceFolder | undefined;

    /**
     * 创建目录并在目录下创建 config.json 文件
     * @returns 包含创建结果和配置数据的 Promise
     */
    constructor() {
        // 初始化工作区文件夹信息
        this.wsFolder = vscode.workspace.workspaceFolders?.[0];
    }

    // 提取获取工作区根路径的方法
    private getRootPath(): string | undefined {
        if (!this.wsFolder) {
            console.log('未找到工作区目录');
            return undefined;
        }
        return this.wsFolder.uri.fsPath;
    }

    /**
     * 获取所有目录下的 config.json 文件内容，排除 logs 目录
     * @returns 包含所有 config.json 文件内容的数组
     */
    public async getConfig() {
        const rootPath = this.getRootPath();
        if (!rootPath) {
            return [];
        }

        try {
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
        const rootPath = this.getRootPath();
        if (!rootPath) {
            return;
        }

        try {
            // 构建要删除的目录路径
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

        // 只在根目录下创建logs目录
        const rootPath = this.getRootPath();
        if (rootPath && dirPath === rootPath) {
            const logsPath = path.join(dirPath, 'logs');
            try {
                await fs.access(logsPath);
            } catch {
                await fs.mkdir(logsPath);
                console.log(`创建 logs 目录: ${logsPath}`);
            }
        }

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

    /**
     * 提取写入配置文件的方法
     * @param dirPath 目录路径
     * @param content 配置内容
     */
    private async writeConfigFile(dirPath: string, content: any) {
        const configFilePath = path.join(dirPath, 'config.json');
        await fs.writeFile(configFilePath, JSON.stringify(content, null, 2));
        console.log(`文件 ${configFilePath} 创建成功`);
    }

    public async createConfig(content: any) {
        const rootPath = this.getRootPath();
        if (!rootPath) {
            return;
        }

        const { account } = content;
        console.log(account);

        // 构建目录路径
        const dirPath = path.join(rootPath, account);

        try {
            await fs.stat(dirPath);
            console.log(`目录 ${dirPath} 已存在，复写文件`);
            await this.writeConfigFile(dirPath, content);
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

        // 写入配置文件
        await this.writeConfigFile(dirPath, content);
    }
}

/** @format */

import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs'; // 使用 fs/promises 模块

/**
 * 创建目录并在目录下创建 config.json 文件
 * @param workspacePath 工作区路径
 */
interface createConfigParams {
    isHasConfig?: boolean;
    isCreate?: boolean;
    datas?: { name: string; pwd: string };
}

// 修改函数签名，添加返回类型
const createConfig = (): Promise<createConfigParams> => {
    console.log('开始检测工作区...');
    return new Promise((resolve, reject) => {
        resolve({ isCreate: true });
        // 获取当前工作区
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspacePath = workspaceFolders[0].uri.fsPath;

            // 检测 logs 目录是否存在，如果不存在则创建
            const logsDirPath = path.join(workspacePath, 'logs');
            fs.access(logsDirPath)
                .catch(async () => {
                    await fs.mkdir(logsDirPath, { recursive: true });
                    console.log(`日志目录已创建: ${logsDirPath}`);
                })
                .then(() => console.log(`日志目录已存在: ${logsDirPath}`));

            // 查找所有以 .vmud 为后缀的文件
            vscode.workspace.findFiles('**/*.vmud').then(async (files) => {
                if (files.length > 0) {
                    for (const file of files) {
                        // 获取文件名
                        const fileName = path.basename(file.fsPath);
                        // 获取文件名前缀（去掉 .vmud 后缀）
                        let dirName: any = fileName.replace('.vmud', '');
                        dirName = dirName.split('\\');
                        dirName = dirName[dirName.length - 1];
                        // 创建以文件名前缀为名称的目录
                        const dirPath = path.join(workspacePath, dirName);
                        const configFilePath = path.join(dirPath, 'config.json');

                        try {
                            // 检查 config.json 文件是否存在
                            const configFileExists = await fs
                                .access(configFilePath)
                                .then(() => true)
                                .catch(() => false);

                            if (configFileExists) {
                                // 读取文件内容
                                const fileContent = JSON.parse(await fs.readFile(configFilePath, 'utf8'));
                                resolve({ isHasConfig: true, datas: fileContent });
                                continue;
                            }

                            // 创建目录
                            await fs.mkdir(dirPath, { recursive: true });
                            console.log(`目录已创建: ${dirPath}`);

                            // 在目录下创建 config.json 文件
                            const configContent = JSON.stringify({ name: '', pwd: '' });
                            await fs.writeFile(configFilePath, configContent, 'utf8');
                            console.log(`文件已创建: ${configFilePath}`);

                            // 返回对象包含 isCreate 属性
                            resolve({ isCreate: true });
                        } catch (error) {
                            console.error(`创建目录或文件失败: ${error}`);
                        }
                    }
                } else {
                    console.log('未找到任何 .vmud 文件，跳过创建操作');
                }
            });
        } else {
            console.log('未打开任何工作区，无法执行操作');
        }
    });
};

export { createConfig };

//@ts-check

'use strict';

const path = require('path');
const webpack = require('webpack');

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

/** @type WebpackConfig */
const extensionConfig = {
    target: 'node', // VS Code 扩展运行在 Node.js 环境中 📖 -> https://webpack.js.org/configuration/node/
    mode: 'none', // 保持源码尽可能接近原始状态（打包时会设置为 'production' 模式）

    entry: './src/extension.ts', // 扩展的入口文件 📖 -> https://webpack.js.org/configuration/entry-context/
    output: {
        // 打包后的文件存储在 'dist' 文件夹中（参考 package.json） 📖 -> https://webpack.js.org/configuration/output/
        path: path.resolve(__dirname, 'dist'),
        filename: 'extension.js', // 输出文件名
        libraryTarget: 'commonjs2' // 输出库的目标格式为 CommonJS2
    },
    externals: {
        vscode: 'commonjs vscode' // vscode 模块是动态创建的，必须排除在外。添加其他无法被 webpack 打包的模块 📖 -> https://webpack.js.org/configuration/externals/
        // 添加到这里的模块也需要添加到 .vscodeignore 文件中
    },
    resolve: {
        // 支持读取 TypeScript 和 JavaScript 文件 📖 -> https://github.com/TypeStrong/ts-loader
        extensions: ['.ts', '.js'] // 解析这些扩展名的文件
    },
    module: {
        rules: [
            {
                test: /\.ts$/, // 匹配所有 .ts 文件
                exclude: /node_modules/, // 排除 node_modules 文件夹
                use: [
                    {
                        loader: 'ts-loader' // 使用 ts-loader 处理 TypeScript 文件
                    }
                ]
            }
        ]
    },
    devtool: 'nosources-source-map', // 生成 source map，但不包含源代码
    infrastructureLogging: {
        level: 'log' // 启用日志记录，便于问题匹配器使用
    },
    // 配置插件
    plugins: [
        // 定义全局环境变量
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production') // 设置环境变量 NODE_ENV，默认为 'production'
        })
    ]
};

module.exports = [extensionConfig]; // 导出配置

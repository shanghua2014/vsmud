// 导入 Node.js 的 net 模块，该模块提供了创建网络套接字的功能
import * as net from 'net';

export class TelnetClient {
    // 私有属性，存储一个 net.Socket 实例，用于与 Telnet 服务器进行网络通信
    private client: net.Socket;
    private isConnected: boolean = false;

    /**
     * 构造函数，初始化 Telnet 客户端。
     * @param host - Telnet 服务器的主机地址。
     * @param port - Telnet 服务器监听的端口号。
     */
    constructor(private host: string, private port: number) {
        // 创建一个新的网络套接字实例
        this.client = new net.Socket();
        const iconv = require('iconv-lite'); // 引入 iconv-lite 库
        this.client.on('data', (data) => {
            const decodedData = iconv.decode(data, 'UTF-8'); // 使用 iconv-lite 解码 gb2312 编码的数据
            console.log('Decoded data:', decodedData);
        });
    }

    /**
     * 连接到 Telnet 服务器。
     * @returns 一个 Promise，当连接成功时 resolve，连接失败时 reject 并返回错误信息。
     */
    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            // 尝试连接到指定的 Telnet 服务器
            this.client.connect(this.port, this.host, () => {
                // 连接成功时输出日志
                console.log(`Telnet 已连接到 ${this.host}:${this.port}`);
                this.isConnected = true; // 设置连接状态
                // 连接成功，resolve Promise
                resolve();
            });

            // 监听套接字的错误事件
            this.client.on('error', (err) => {
                // 发生错误时输出错误日志
                console.error('Telnet connection error:', err);
                this.isConnected = false; // 重置连接状态
                // 连接失败，reject Promise 并返回错误信息
                reject(err);
            });
        });
    }

    /**
     * 向 Telnet 服务器发送数据。
     * @param data - 要发送的字符串数据，会自动在末尾添加换行符。
     */
    sendData(data: string): void {
        if (!this.isConnected) {
            console.error('未连接到服务器，无法发送数据');
            return;
        }
        // 向服务器发送数据，并在数据末尾添加回车换行符
        console.log(`发给服务器: ${data}`);
        this.client.write(data + '\r\n');
    }

    /**
     * 监听来自 Telnet 服务器的数据。
     * @param callback - 当接收到数据时调用的回调函数，参数为接收到的字符串数据。
     */
    onData(callback: (data: string) => void): void {
        // 监听套接字的 data 事件
        this.client.on('data', (data) => {
            // 当接收到数据时，将数据转换为字符串并调用回调函数
            callback(data.toString());
        });
    }

    disconnect(): void {
        this.client.end(() => {
            console.log('Disconnected from Telnet server');
        });
    }
}

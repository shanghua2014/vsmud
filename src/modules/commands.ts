// 定义命令参数的类型
interface CommandArg {
    message: {
        content: string;
    };
    files: any;
    document: any;
    wvPanel: any;
    telnet: any;
    reload: Function;
    reconnect: Function;
}

export class Commands {
    private files: any;
    private document: any;
    private wvPanel: any;
    private telnet: any;

    constructor() {}

    /**
     * 执行命令
     * @param arg
     * @returns
     */
    public command = async (arg: CommandArg) => {
        !this.document ? (this.document = arg.document) : '';
        !this.files ? (this.files = arg.files) : '';
        !this.wvPanel ? (this.wvPanel = arg.wvPanel) : '';
        !this.telnet ? (this.telnet = arg.telnet) : '';

        if (/^#[a-z]{2}/.test(arg.message.content)) {
            const cont = arg.message.content;
            if (cont === '#reload' || cont === '#re') {
                // 脚本重载
                await this.files.copyFile(this.document);
                await arg.reload();
            } else if (cont === '#rec') {
                // 账号重连
                // telnetToServe(ip, port, wvPanel);
            }
        } else {
            this.telnet = arg.telnet;
            this.telnet.sendData(arg.message.content);
        }
    };
}

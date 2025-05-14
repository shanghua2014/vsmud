// 定义命令参数的类型
interface CommandArg {
    message: {
        content: string;
    };
    files: any;
    telnet: any;
    reload: Function;
}

export class Commands {
    private telnet: any;
    private files: any;
    private document: any;

    constructor() {
        this.telnet = '' as any;
    }

    // 执行命令
    /**
     *
     * @param arg
     * @param document
     * @param wvPanel
     */
    public command = async (arg: CommandArg, wvPanel: any) => {
        if (/^#[a-z]{2}/.test(arg.message.content)) {
            const cont = arg.message.content;
            if (cont === '#reload' || cont === '#re') {
                // 脚本重载
                this.files = arg.files;
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

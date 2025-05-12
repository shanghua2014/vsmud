
module.exports = {
    Aliases: () => {
        const a = [];
        a.push({
            name: "触发成功执行回调",
            reg: "触发语句",
            group: "sys",
            enable: true,
        });
        a.push({
            name: "触发成功执行命令",
            reg: "触发器 action",
            group: "触发器 group",
            cmd: "look",
            enable: true,
        });
        return a;
    },
}
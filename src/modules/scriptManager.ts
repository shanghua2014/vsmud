/**
 * 脚本管理类，用于处理与脚本相关的逻辑
 */
export class ScriptManager {
    /**
     * 获取默认触发器内容
     * @returns 默认触发器内容
     */
    public triggers(): string {
        return `
module.exports = {
    Triggers: () => {
        const tr = [];
        tr.push({
            name: "触发成功执行回调",
            reg: "触发语句",
            group: "sys",
            enable: true,
            onSuccess: () => {return "hehe"},
        });
        tr.push({
            name: "触发成功执行命令",
            reg: "触发器 action",
            group: "触发器 group",
            enable: true,
            cmd: "look",
        });
        return tr;
    },
}`;
    }

    /**
     * 获取默认别名内容
     * @returns 默认别名内容
     */
    public alias(): string {
        return `
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
}`;
    }

    /**
     * 获取默认定时器内容
     * @returns 默认别名内容
     */
    public timers(): string {
        return `
module.exports = {
    Aliases: () => {
        const ti = [];
        ti.push({
            name: "触发成功执行回调",
            reg: "触发语句",
            group: "sys",
            enable: true,
        });
        ti.push({
            name: "触发成功执行命令",
            reg: "触发器 action",
            group: "触发器 group",
            cmd: "look",
            enable: true,
        });
        
        return ti;
    },
}`;
    }
}

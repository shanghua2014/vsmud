/**
 * 触发器
 * @author shanghua
 * @since 2025-05-10
 * @version 1.0.0
 * @description 触发器
 * @param {string} name - 名称
 * @param {string} group - 分组
 * @param {string} reg - 正则表达式
 * @param {string} cmd - 命令
 * @param {function} onSuccess - 成功回调
 * @returns {Array} - 触发器数组
 * @example const triggers = Triggers()
 */
declare type TRIGGER = () => Array<{
    name?: string;
    group?: string;
    reg: string;
    cmd?: string;
    onSuccess?: () => string;
}>;
export const Triggers: TRIGGER;

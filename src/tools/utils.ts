// 定义一个统一的错误处理函数
export async function handleError<T>(promise: Promise<T>): Promise<[T | null, Error | null]> {
    try {
        const result = await promise;
        return [result, null];
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('发生错误:', error.message);
        return [null, error];
    }
}

/**
 * 去除字符串中的 ANSI 转义序列
 * @param str - 包含 ANSI 转义序列的字符串
 * @returns 去除 ANSI 转义序列后的普通字符串
 */
export function stripAnsi(str: string): string {
    // 使用正则表达式匹配并替换 ANSI 转义序列
    return str.replace(/\x1B\[\d+(;\d+)*[mK]/g, '');
}

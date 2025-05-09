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

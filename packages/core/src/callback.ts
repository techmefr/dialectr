export function runCallback<B extends object>(
    method: string,
    callback: (builder: B) => B,
    received: B,
): B {
    const result = callback(received)
    if (result === undefined || result === received) {
        throw new Error(
            `${method} callback must chain the builder and return the result: builders are immutable, so write builder => builder.where(...).where(...) instead of calling builder.where(...) and returning the original builder`,
        )
    }
    return result
}

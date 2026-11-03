export type Field<T> = Extract<keyof T, string>

export type FieldValue<T, K extends Field<T>> = Exclude<T[K], undefined>

export interface ExtensionMap {}

export type Present<V> = Exclude<V, null | undefined | false | 0 | ''>

export type ComparisonOperator = '=' | '!=' | '>' | '>=' | '<' | '<='

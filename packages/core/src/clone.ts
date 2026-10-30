import { MAX_DEPTH, MAX_EXTENSION_KEYS, MAX_LIST, MAX_NODES } from './limits.ts'
import type { Aggregate, FilterNode, Include, Query, Sort } from './types.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object'
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (!isRecord(value) || Array.isArray(value)) return false
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
}

function define(target: Record<string, unknown>, key: string, value: unknown): void {
    Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true })
}

function copyArray<I, O>(value: unknown, limit: number, label: string, copy: (item: I) => O): O[] {
    if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
    const length = value.length
    if (length > limit) {
        throw new Error(limit === MAX_NODES ? `Query exceeds ${MAX_NODES} nodes` : `${label} are limited to ${limit} items`)
    }
    const result: O[] = []
    for (let index = 0; index < length; index++) {
        if (!Object.hasOwn(value, index)) throw new Error('Sparse arrays are not allowed')
        result.push(copy(value[index] as I))
    }
    return result
}

function atDepth(depth: number): void {
    if (depth > MAX_DEPTH) throw new Error(`Query nesting exceeds ${MAX_DEPTH} levels`)
}

export function cloneValue<V>(value: V): V {
    if (Array.isArray(value)) return copyArray(value, MAX_LIST, 'List values', item => cloneValue(item)) as V
    if (value instanceof Date) return new Date(value.getTime()) as V
    return value
}

export function cloneExtensionValue(value: unknown, depth = 0): unknown {
    if (depth > MAX_DEPTH) throw new Error(`Extension nesting exceeds ${MAX_DEPTH} levels`)
    if (Array.isArray(value)) return copyArray(value, MAX_NODES, 'Extension lists', item => cloneExtensionValue(item, depth + 1))
    if (value instanceof Date) return new Date(value.getTime())
    if (isPlainObject(value)) {
        const keys = Object.keys(value)
        if (keys.length > MAX_NODES) throw new Error(`Extension objects are limited to ${MAX_NODES} keys`)
        const copy: Record<string, unknown> = {}
        for (const key of keys) define(copy, key, cloneExtensionValue(value[key], depth + 1))
        return copy
    }
    return value
}

function cloneExtensions(extensions: unknown): unknown {
    if (!isPlainObject(extensions)) return extensions
    const keys = Object.keys(extensions)
    if (keys.length > MAX_EXTENSION_KEYS) throw new Error(`Extensions are limited to ${MAX_EXTENSION_KEYS} targets`)
    const copy: Record<string, unknown> = {}
    for (const key of keys) define(copy, key, cloneExtensionValue(extensions[key], 1))
    return copy
}

function cloneNodes(nodes: unknown, depth: number): FilterNode[] {
    return copyArray<unknown, FilterNode>(nodes, MAX_NODES, 'Filters', node => {
        if (!isRecord(node)) throw new Error('Unknown filter node kind')
        if (node.kind === 'group') {
            atDepth(depth + 1)
            return {
                kind: 'group',
                boolean: node.boolean as FilterNode['boolean'],
                nodes: cloneNodes(node.nodes, depth + 1),
            }
        }
        if (node.kind === 'condition') {
            return {
                kind: 'condition',
                boolean: node.boolean as FilterNode['boolean'],
                field: node.field as string,
                operator: node.operator as never,
                value: cloneValue(node.value),
            }
        }
        throw new Error('Unknown filter node kind')
    })
}

function cloneSort(sort: unknown): Sort {
    if (!isRecord(sort)) throw new Error('Sorts must be objects')
    return { field: sort.field as string, direction: sort.direction as Sort['direction'] }
}

function cloneInclude(include: unknown, depth: number): Include {
    if (!isRecord(include)) throw new Error('Includes must be objects')
    return { relation: include.relation as string, query: cloneAt(include.query, depth + 1) }
}

function cloneAggregate(aggregate: unknown, depth: number): Aggregate {
    if (!isRecord(aggregate)) throw new Error('Aggregates must be objects')
    return {
        type: aggregate.type as Aggregate['type'],
        relation: aggregate.relation as string,
        ...(aggregate.field === undefined ? {} : { field: aggregate.field as string }),
        filters: cloneNodes(aggregate.filters, depth),
    }
}

function cloneAt(source: unknown, depth: number): Query {
    atDepth(depth)
    if (!isRecord(source)) throw new Error('A query must be an object')
    const extensions = source.extensions === undefined ? undefined : cloneExtensions(source.extensions)
    const hasExtensions = extensions !== undefined && !(isPlainObject(extensions) && Object.keys(extensions).length === 0)
    return {
        filters: cloneNodes(source.filters, depth),
        sorts: copyArray(source.sorts, MAX_NODES, 'Sorts', cloneSort),
        selects: copyArray(source.selects, MAX_NODES, 'Selects', item => item as string),
        includes: copyArray(source.includes, MAX_NODES, 'Includes', item => cloneInclude(item, depth)),
        aggregates: copyArray(source.aggregates, MAX_NODES, 'Aggregates', item => cloneAggregate(item, depth)),
        ...(source.search === undefined ? {} : { search: source.search as string }),
        ...(hasExtensions ? { extensions: extensions as Record<string, unknown> } : {}),
        ...(source.limit === undefined ? {} : { limit: source.limit as number }),
        ...(source.page === undefined ? {} : { page: source.page as number }),
    }
}

export function cloneQuery(query: Query): Query {
    return cloneAt(query, 0)
}

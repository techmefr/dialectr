import { containsPattern, getExtension, prepareQuery } from 'dialectr'
import type { Aggregate, FilterNode, Include, Query } from 'dialectr'

export interface LomkitFilter {
    field?: string
    operator?: string
    value?: unknown
    type?: 'or'
    nested?: LomkitFilter[]
}

export interface LomkitAggregate {
    relation: string
    type: string
    field?: string
    filters?: LomkitFilter[]
}

export interface LomkitSearch {
    filters?: LomkitFilter[]
    sorts?: Array<{ field: string; direction: 'asc' | 'desc' }>
    selects?: Array<{ field: string }>
    includes?: LomkitInclude[]
    aggregates?: LomkitAggregate[]
    text?: { value: string }
    scopes?: unknown[]
    instructions?: unknown[]
    gates?: unknown[]
    limit?: number
    page?: number
}

export interface LomkitInclude extends LomkitSearch {
    relation: string
}

export interface LomkitPayload {
    search: LomkitSearch
}

export const LOMKIT_TARGET = 'lomkit'

const EXTENSION_KEYS = ['scopes', 'instructions', 'gates'] as const

function extension(query: Query): Partial<LomkitSearch> {
    const value = getExtension(query, LOMKIT_TARGET)
    if (value === undefined) return {}
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('The lomkit extension must be an object')
    }
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(value)) {
        if (!(EXTENSION_KEYS as readonly string[]).includes(key)) {
            throw new Error(`Unsupported lomkit extension key: "${key}"`)
        }
        const entry = (value as Record<string, unknown>)[key]
        if (!Array.isArray(entry)) throw new Error(`The lomkit extension "${key}" must be an array`)
        result[key] = entry
    }
    return result
}

function scalar(value: unknown): unknown {
    if (value === undefined) return null
    if (value instanceof Date) return value.toISOString()
    return value
}

function filters(nodes: FilterNode[]): LomkitFilter[] {
    return nodes.map((node, index) => {
        const type = index > 0 && node.boolean === 'or' ? ('or' as const) : undefined
        const base: LomkitFilter =
            node.kind === 'group'
                ? { nested: filters(node.nodes) }
                : {
                      field: node.field,
                      operator: node.operator,
                      value:
                          node.operator === 'like' || node.operator === 'not like'
                              ? containsPattern(String(node.value))
                              : Array.isArray(node.value)
                                ? node.value.map(scalar)
                                : scalar(node.value),
                  }
        return type ? { ...base, type } : base
    })
}

function aggregate(item: Aggregate): LomkitAggregate {
    return {
        relation: item.relation,
        type: item.type,
        ...(item.field === undefined ? {} : { field: item.field }),
        ...(item.filters.length === 0 ? {} : { filters: filters(item.filters) }),
    }
}

function include(item: Include): LomkitInclude {
    return { relation: item.relation, ...search(item.query) }
}

function search(query: Query): LomkitSearch {
    const result: LomkitSearch = {}
    if (query.filters.length > 0) result.filters = filters(query.filters)
    if (query.sorts.length > 0) result.sorts = query.sorts.map(sort => ({ field: sort.field, direction: sort.direction }))
    if (query.selects.length > 0) result.selects = query.selects.map(field => ({ field }))
    if (query.includes.length > 0) result.includes = query.includes.map(include)
    if (query.aggregates.length > 0) result.aggregates = query.aggregates.map(aggregate)
    if (query.search !== undefined) result.text = { value: query.search }
    if (query.limit !== undefined) result.limit = query.limit
    if (query.page !== undefined) result.page = query.page
    return { ...result, ...extension(query) }
}

export function toLomkit(query: Query): LomkitPayload {
    return { search: search(prepareQuery(query)) }
}

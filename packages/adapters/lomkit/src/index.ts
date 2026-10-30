import { assertQuery, containsPattern } from 'dialectr'
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
    limit?: number
    page?: number
}

export interface LomkitInclude extends LomkitSearch {
    relation: string
}

export interface LomkitPayload {
    search: LomkitSearch
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
                              : node.value,
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
    if (query.sorts.length > 0) result.sorts = query.sorts.map(sort => ({ ...sort }))
    if (query.selects.length > 0) result.selects = query.selects.map(field => ({ field }))
    if (query.includes.length > 0) result.includes = query.includes.map(include)
    if (query.aggregates.length > 0) result.aggregates = query.aggregates.map(aggregate)
    if (query.limit !== undefined) result.limit = query.limit
    if (query.page !== undefined) result.page = query.page
    return result
}

export function toLomkit(query: Query): LomkitPayload {
    assertQuery(query)
    return { search: search(query) }
}

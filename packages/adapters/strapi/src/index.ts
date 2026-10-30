import { groupByOr } from 'dialectr'
import type { Condition, FilterNode, Query } from 'dialectr'

export type StrapiFilter = Record<string, unknown>

export interface StrapiParams {
    filters?: StrapiFilter
    sort?: string[]
    fields?: string[]
    populate?: string[] | Record<string, StrapiParams>
    pagination?: { page?: number; pageSize?: number }
}

const SIMPLE: Record<string, string> = {
    '=': '$eq',
    '!=': '$ne',
    '>': '$gt',
    '>=': '$gte',
    '<': '$lt',
    '<=': '$lte',
    in: '$in',
    'not in': '$notIn',
}

function like(value: unknown): { operator: string; value: string } {
    const text = String(value)
    const start = text.startsWith('%')
    const end = text.endsWith('%')
    const core = text.slice(start ? 1 : 0, end ? -1 : undefined)
    if (start && end) return { operator: '$containsi', value: core }
    if (end) return { operator: '$startsWithi', value: core }
    if (start) return { operator: '$endsWithi', value: core }
    return { operator: '$eqi', value: core }
}

function nest(path: string, leaf: unknown): StrapiFilter {
    return path
        .split('.')
        .reverse()
        .reduce<unknown>((inner, key) => ({ [key]: inner }), leaf) as StrapiFilter
}

function condition(node: Condition): StrapiFilter {
    if (node.operator === 'like' || node.operator === 'not like') {
        const { operator, value } = like(node.value)
        const leaf = { [operator]: value }
        return nest(node.field, node.operator === 'like' ? leaf : { $not: leaf })
    }
    return nest(node.field, { [SIMPLE[node.operator]]: node.value })
}

function expression(nodes: FilterNode[]): StrapiFilter {
    const clusters = groupByOr(nodes).map(cluster => {
        const parts = cluster.map(node => (node.kind === 'group' ? expression(node.nodes) : condition(node)))
        return parts.length === 1 ? parts[0] : { $and: parts }
    })
    return clusters.length === 1 ? clusters[0] : { $or: clusters }
}

export function toStrapi(query: Query): StrapiParams {
    if (query.aggregates.length > 0) throw new Error('Strapi does not support aggregates')
    const params: StrapiParams = {}
    if (query.filters.length > 0) params.filters = expression(query.filters)
    if (query.sorts.length > 0) params.sort = query.sorts.map(sort => `${sort.field}:${sort.direction}`)
    if (query.selects.length > 0) params.fields = [...query.selects]
    if (query.includes.length > 0) {
        const plain = query.includes.every(
            ({ query: inner }) =>
                inner.filters.length === 0 &&
                inner.sorts.length === 0 &&
                inner.selects.length === 0 &&
                inner.includes.length === 0 &&
                inner.limit === undefined &&
                inner.page === undefined,
        )
        params.populate = plain
            ? query.includes.map(include => include.relation)
            : Object.fromEntries(query.includes.map(include => [include.relation, toStrapi(include.query)]))
    }
    if (query.page !== undefined || query.limit !== undefined) {
        params.pagination = {
            ...(query.page === undefined ? {} : { page: query.page }),
            ...(query.limit === undefined ? {} : { pageSize: query.limit }),
        }
    }
    return params
}

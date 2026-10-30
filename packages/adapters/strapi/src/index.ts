import { assertQuery, groupByOr, parseLike } from 'dialectr'
import type { Condition, FilterNode, Query } from 'dialectr'

export const STRAPI_TARGET = 'strapi'

export type StrapiFilter = Record<string, unknown>

export interface StrapiParams {
    filters?: StrapiFilter
    sort?: string[]
    fields?: string[]
    populate?: string[] | Record<string, StrapiParams>
    pagination?: { page?: number; pageSize?: number }
}

const SIMPLE = new Map<string, string>([
    ['=', '$eq'],
    ['!=', '$ne'],
    ['>', '$gt'],
    ['>=', '$gte'],
    ['<', '$lt'],
    ['<=', '$lte'],
    ['in', '$in'],
    ['not in', '$notIn'],
])

const SEGMENT = /^[A-Za-z_][A-Za-z0-9_]*$/

function path(name: string): string[] {
    const segments = name.split('.')
    for (const segment of segments) {
        if (!SEGMENT.test(segment)) throw new Error(`Unsupported field name: "${name}"`)
    }
    return segments
}

function like(value: unknown): { operator: string; value: string } {
    const { literal, leading, trailing, inner } = parseLike(String(value))
    if (inner) throw new Error(`Strapi only supports a leading or trailing "%" in like patterns: "${String(value)}"`)
    if (leading && trailing) return { operator: '$containsi', value: literal }
    if (trailing) return { operator: '$startsWithi', value: literal }
    if (leading) return { operator: '$endsWithi', value: literal }
    return { operator: '$containsi', value: literal }
}

function nest(name: string, leaf: unknown): StrapiFilter {
    return path(name)
        .reverse()
        .reduce<unknown>((inner, key) => ({ [key]: inner }), leaf) as StrapiFilter
}

function scalar(value: unknown): unknown {
    if (value === undefined) return null
    if (value instanceof Date) return value.toISOString()
    return value
}

function condition(node: Condition): StrapiFilter {
    if (node.operator === 'like' || node.operator === 'not like') {
        const { operator, value } = like(node.value)
        const leaf = { [operator]: value }
        return nest(node.field, node.operator === 'like' ? leaf : { $not: leaf })
    }
    const operator = SIMPLE.get(node.operator)
    if (operator === undefined) throw new Error(`Unknown operator: "${String(node.operator)}"`)
    const value = Array.isArray(node.value) ? node.value.map(scalar) : scalar(node.value)
    return nest(node.field, { [operator]: value })
}

function expression(nodes: FilterNode[]): StrapiFilter {
    const clusters = groupByOr(nodes).map(cluster => {
        const parts = cluster.map(node => (node.kind === 'group' ? expression(node.nodes) : condition(node)))
        return parts.length === 1 ? parts[0] : { $and: parts }
    })
    return clusters.length === 1 ? clusters[0] : { $or: clusters }
}

function isPlain(inner: Query): boolean {
    return (
        inner.search === undefined &&
        inner.extensions?.[STRAPI_TARGET] === undefined &&
        inner.filters.length === 0 &&
        inner.sorts.length === 0 &&
        inner.selects.length === 0 &&
        inner.includes.length === 0 &&
        inner.limit === undefined &&
        inner.page === undefined
    )
}

function params(query: Query): StrapiParams {
    if (query.search !== undefined) throw new Error('Strapi does not support free-text search')
    if (query.extensions?.[STRAPI_TARGET] !== undefined) throw new Error('Strapi does not support extensions')
    if (query.aggregates.length > 0) throw new Error('Strapi does not support aggregates')
    const result: StrapiParams = {}
    if (query.filters.length > 0) result.filters = expression(query.filters)
    if (query.sorts.length > 0) {
        result.sort = query.sorts.map(sort => `${path(sort.field).join('.')}:${sort.direction}`)
    }
    if (query.selects.length > 0) result.fields = query.selects.map(name => path(name).join('.'))
    if (query.includes.length > 0) {
        const relations = query.includes.map(include => path(include.relation).join('.'))
        result.populate = query.includes.every(include => isPlain(include.query))
            ? relations
            : Object.fromEntries(query.includes.map((include, index) => [relations[index], params(include.query)]))
    }
    if (query.page !== undefined || query.limit !== undefined) {
        result.pagination = {
            ...(query.page === undefined ? {} : { page: query.page }),
            ...(query.limit === undefined ? {} : { pageSize: query.limit }),
        }
    }
    return result
}

export function toStrapi(query: Query): StrapiParams {
    assertQuery(query)
    return params(query)
}

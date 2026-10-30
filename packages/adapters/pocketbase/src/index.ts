import { groupByOr } from 'dialectr'
import type { Condition, FilterNode, Query } from 'dialectr'

export interface PocketbaseParams {
    filter?: string
    sort?: string
    fields?: string
    expand?: string
    page?: number
    perPage?: number
}

const OPERATORS: Record<string, string> = {
    '=': '=',
    '!=': '!=',
    '>': '>',
    '>=': '>=',
    '<': '<',
    '<=': '<=',
    like: '~',
    'not like': '!~',
}

const FIELD = /^[A-Za-z_][A-Za-z0-9_.:]*$/

function field(name: string): string {
    if (!FIELD.test(name)) throw new Error(`Unsupported field name: "${name}"`)
    return name
}

function literal(value: unknown): string {
    if (value === null || value === undefined) return 'null'
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (value instanceof Date) return `'${value.toISOString().replace('T', ' ')}'`
    return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

function condition(node: Condition): string {
    const name = field(node.field)
    if (node.operator === 'in' || node.operator === 'not in') {
        const values = node.value as unknown[]
        if (values.length === 0) return node.operator === 'in' ? 'false' : 'true'
        const joiner = node.operator === 'in' ? ' || ' : ' && '
        const operator = node.operator === 'in' ? '=' : '!='
        return `(${values.map(value => `${name}${operator}${literal(value)}`).join(joiner)})`
    }
    return `${name}${OPERATORS[node.operator]}${literal(node.value)}`
}

function expression(nodes: FilterNode[]): string {
    const clusters = groupByOr(nodes).map(cluster =>
        cluster.map(node => (node.kind === 'group' ? `(${expression(node.nodes)})` : condition(node))).join(' && '),
    )
    return clusters.length > 1 ? clusters.map(cluster => `(${cluster})`).join(' || ') : (clusters[0] ?? '')
}

export function toPocketbase(query: Query): PocketbaseParams {
    if (query.aggregates.length > 0) throw new Error('PocketBase does not support aggregates')
    const params: PocketbaseParams = {}
    if (query.filters.length > 0) params.filter = expression(query.filters)
    if (query.sorts.length > 0) {
        params.sort = query.sorts.map(sort => `${sort.direction === 'desc' ? '-' : ''}${field(sort.field)}`).join(',')
    }
    if (query.selects.length > 0) params.fields = query.selects.map(field).join(',')
    if (query.includes.length > 0) params.expand = query.includes.map(include => field(include.relation)).join(',')
    if (query.page !== undefined) params.page = query.page
    if (query.limit !== undefined) params.perPage = query.limit
    return params
}

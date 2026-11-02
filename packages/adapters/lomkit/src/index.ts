import { containsPattern, getExtension, prepareQuery, pruneAlwaysTrue } from 'dialectr'
import type { Aggregate, FilterNode, Include, Query } from 'dialectr'

export type LomkitGate = 'create' | 'view' | 'update' | 'delete' | 'restore' | 'forceDelete'

export interface LomkitScope {
    name: string
    parameters?: unknown[]
}

export interface LomkitInstructionField {
    name: string
    value: unknown
}

export interface LomkitInstruction {
    name: string
    fields?: LomkitInstructionField[]
}

export interface LomkitExtension {
    gates?: LomkitGate[]
    scopes?: LomkitScope[]
    instructions?: LomkitInstruction[]
}

declare module 'dialectr' {
    interface ExtensionMap {
        lomkit: LomkitExtension
    }
}

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
    alias?: string
    filters?: LomkitFilter[]
}

export interface LomkitSearch {
    filters?: LomkitFilter[]
    sorts?: Array<{ field: string; direction: 'asc' | 'desc' }>
    selects?: Array<{ field: string }>
    includes?: LomkitInclude[]
    aggregates?: LomkitAggregate[]
    text?: { value: string }
    scopes?: LomkitScope[]
    instructions?: LomkitInstruction[]
    gates?: LomkitGate[]
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
    if (value instanceof Date) return value.toISOString().slice(0, 19).replace('T', ' ')
    return value
}

function listValue(value: unknown[]): unknown[] {
    return value.length === 0 ? [null] : value.map(scalar)
}

function filters(nodes: FilterNode[]): LomkitFilter[] {
    const pruned = pruneAlwaysTrue(nodes)
    return pruned === null ? [] : compile(pruned)
}

function compile(nodes: FilterNode[]): LomkitFilter[] {
    return nodes.map((node, index) => {
        const type = index > 0 && node.boolean === 'or' ? ('or' as const) : undefined
        const base: LomkitFilter =
            node.kind === 'group'
                ? { nested: compile(node.nodes) }
                : {
                      field: node.field,
                      operator: node.operator,
                      value:
                          node.operator === 'like' || node.operator === 'not like'
                              ? containsPattern(String(node.value))
                              : Array.isArray(node.value)
                                ? listValue(node.value)
                                : scalar(node.value),
                  }
        return type ? { ...base, type } : base
    })
}

function defaultKey(item: Aggregate): string {
    return [item.relation, item.type, item.field].filter(part => part !== undefined).join('_')
}

function aggregates(items: Aggregate[]): LomkitAggregate[] {
    const taken = new Set(items.flatMap(item => (item.alias === undefined ? [] : [item.alias])))
    return items.map(item => {
        let alias = item.alias
        if (alias === undefined) {
            const base = defaultKey(item)
            if (taken.has(base)) {
                let suffix = 2
                while (taken.has(`${base}_${suffix}`)) suffix++
                alias = `${base}_${suffix}`
            }
            taken.add(alias ?? base)
        }
        const compiled = filters(item.filters)
        return {
            relation: item.relation,
            type: item.type,
            ...(item.field === undefined ? {} : { field: item.field }),
            ...(alias === undefined ? {} : { alias }),
            ...(compiled.length === 0 ? {} : { filters: compiled }),
        }
    })
}

function includes(items: Include[]): LomkitInclude[] {
    const roots: LomkitInclude[] = []
    for (const item of items) {
        const segments = item.relation.split('.')
        let level = roots
        segments.forEach((segment, index) => {
            let node = level.find(candidate => candidate.relation === segment)
            if (node === undefined) {
                node = { relation: segment }
                level.push(node)
            }
            if (index === segments.length - 1) {
                const compiled = search(item.query)
                const nested = [...(node.includes ?? []), ...(compiled.includes ?? [])]
                Object.assign(node, compiled)
                if (nested.length > 0) node.includes = nested
            } else {
                node.includes ??= []
                level = node.includes
            }
        })
    }
    return roots
}

function search(query: Query): LomkitSearch {
    const result: LomkitSearch = {}
    const compiledFilters = filters(query.filters)
    if (compiledFilters.length > 0) result.filters = compiledFilters
    if (query.sorts.length > 0) result.sorts = query.sorts.map(sort => ({ field: sort.field, direction: sort.direction }))
    if (query.selects.length > 0) result.selects = query.selects.map(field => ({ field }))
    if (query.includes.length > 0) result.includes = includes(query.includes)
    if (query.aggregates.length > 0) result.aggregates = aggregates(query.aggregates)
    if (query.search !== undefined) result.text = { value: query.search }
    if (query.limit !== undefined) result.limit = query.limit
    if (query.page !== undefined) result.page = query.page
    return { ...result, ...extension(query) }
}

export function toLomkit(query: Query): LomkitPayload {
    return { search: search(prepareQuery(query)) }
}

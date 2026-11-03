import { cloneQuery } from './clone.ts'
import { assertDirection, assertField, assertLimit, assertPage, assertSearch, assertValue, spend } from './assertions.ts'
import type { Budget } from './assertions.ts'
import { assertExtensionKey, checkExtensionValue, isPlainRecord } from './extensions.ts'
import {
    MAX_DEPTH,
    MAX_EXTENSION_KEYS,
    MAX_FIELD_LENGTH,
    MAX_LIMIT,
    MAX_LIST,
    MAX_NODES,
    MAX_PAGE,
    MAX_SEARCH_LENGTH,
    MAX_VALUE_LENGTH,
} from './limits.ts'
import type { FilterNode, Query } from './types.ts'

export {
    MAX_DEPTH,
    MAX_EXTENSION_KEYS,
    MAX_FIELD_LENGTH,
    MAX_LIMIT,
    MAX_LIST,
    MAX_NODES,
    MAX_PAGE,
    MAX_SEARCH_LENGTH,
    MAX_VALUE_LENGTH,
}

const CONNECTORS = new Set(['and', 'or'])
const AGGREGATES = new Set(['count', 'min', 'max', 'avg', 'sum', 'exists'])

function checkFilters(nodes: FilterNode[], depth: number, budget: Budget): void {
    if (!Array.isArray(nodes)) throw new Error('filters must be an array')
    spend(budget, nodes.length)
    for (const node of nodes) {
        if (!CONNECTORS.has(node.boolean)) throw new Error(`Unknown connector: "${String(node.boolean)}"`)
        if (node.kind === 'group') {
            if (depth + 1 > MAX_DEPTH) throw new Error(`Query nesting exceeds ${MAX_DEPTH} levels`)
            if (!Array.isArray(node.nodes) || node.nodes.length === 0) throw new Error('Empty filter group')
            checkFilters(node.nodes, depth + 1, budget)
        } else if (node.kind === 'condition') {
            assertField(node.field)
            assertValue(node.operator, node.value, budget)
        } else {
            throw new Error('Unknown filter node kind')
        }
    }
}

function checkQuery(query: Query, depth: number, budget: Budget): void {
    if (depth > MAX_DEPTH) throw new Error(`Query nesting exceeds ${MAX_DEPTH} levels`)
    checkFilters(query.filters, depth, budget)
    spend(budget, query.sorts.length + query.selects.length + query.includes.length + query.aggregates.length)
    for (const sort of query.sorts) {
        assertField(sort.field)
        assertDirection(sort.direction)
    }
    query.selects.forEach(assertField)
    for (const include of query.includes) {
        assertField(include.relation)
        checkQuery(include.query, depth + 1, budget)
    }
    for (const aggregate of query.aggregates) {
        assertField(aggregate.relation)
        if (aggregate.field !== undefined) assertField(aggregate.field)
        if (aggregate.alias !== undefined) assertField(aggregate.alias)
        if (typeof aggregate.type !== 'string' || !AGGREGATES.has(aggregate.type)) {
            throw new Error(`Unknown aggregate type: "${String(aggregate.type)}"`)
        }
        checkFilters(aggregate.filters, depth, budget)
    }
    if (query.search !== undefined) assertSearch(query.search)
    if (query.extensions !== undefined) {
        if (!isPlainRecord(query.extensions)) throw new Error('extensions must be an object')
        const keys = Object.keys(query.extensions)
        if (keys.length > MAX_EXTENSION_KEYS) throw new Error(`Extensions are limited to ${MAX_EXTENSION_KEYS} targets`)
        spend(budget, keys.length)
        for (const key of keys) {
            assertExtensionKey(key)
            checkExtensionValue(query.extensions[key], 1, budget)
        }
    }
    if (query.limit !== undefined) assertLimit(query.limit)
    if (query.page !== undefined) assertPage(query.page)
    if (query.page !== undefined && query.limit === undefined) throw new Error('page() requires limit(): pagination has no effect without a limit')
}

export function prepareQuery(query: Query): Query {
    const snapshot = cloneQuery(query)
    checkQuery(snapshot, 0, { nodes: 0 })
    return snapshot
}

export function assertQuery(query: Query): Query {
    return prepareQuery(query)
}

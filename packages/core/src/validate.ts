import type { FilterNode, Query } from './types.ts'

export const MAX_DEPTH = 32
export const MAX_NODES = 1000
export const MAX_LIMIT = 10000
export const MAX_LIST = 10000
export const MAX_FIELD_LENGTH = 256
export const MAX_SEARCH_LENGTH = 1024

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

const OPERATORS = new Set(['=', '!=', '>', '>=', '<', '<=', 'like', 'not like', 'in', 'not in'])
const CONNECTORS = new Set(['and', 'or'])
const DIRECTIONS = new Set(['asc', 'desc'])
const AGGREGATES = new Set(['count', 'min', 'max', 'avg', 'sum', 'exists'])

interface Budget {
    nodes: number
}

export function isScalar(value: unknown): boolean {
    if (value === null || value === undefined) return true
    if (typeof value === 'string' || typeof value === 'boolean') return true
    if (typeof value === 'number') return Number.isFinite(value)
    if (value instanceof Date) return !Number.isNaN(value.getTime())
    return false
}

export function assertOperator(operator: unknown): void {
    if (typeof operator !== 'string' || !OPERATORS.has(operator)) throw new Error(`Unknown operator: "${String(operator)}"`)
}

export function assertField(name: unknown): void {
    if (typeof name !== 'string' || name.length === 0 || name.length > MAX_FIELD_LENGTH) {
        throw new Error('Field names must be non-empty strings of at most 256 characters')
    }
}

export function assertValue(operator: unknown, value: unknown): void {
    assertOperator(operator)
    if (operator === 'in' || operator === 'not in') {
        if (!Array.isArray(value)) throw new Error(`Operator "${operator}" requires an array value`)
        if (value.length > MAX_LIST) throw new Error(`List values are limited to ${MAX_LIST} items`)
        if (!value.every(isScalar)) throw new Error('List items must be string, finite number, boolean, null or Date')
        return
    }
    if (operator === 'like' || operator === 'not like') {
        if (typeof value !== 'string') throw new Error(`Operator "${operator}" requires a string value`)
        return
    }
    if (!isScalar(value)) throw new Error('Values must be string, finite number, boolean, null or Date')
}

export function assertLimit(limit: unknown): void {
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1) {
        throw new Error('limit must be a positive integer')
    }
    if (limit > MAX_LIMIT) throw new Error(`limit must not exceed ${MAX_LIMIT}`)
}

export function assertPage(page: unknown): void {
    if (typeof page !== 'number' || !Number.isSafeInteger(page) || page < 1) {
        throw new Error('page must be a positive integer')
    }
}

export function assertDirection(direction: unknown): void {
    if (typeof direction !== 'string' || !DIRECTIONS.has(direction)) {
        throw new Error(`Sort direction must be "asc" or "desc"`)
    }
}

export function assertSearch(text: unknown): void {
    if (typeof text !== 'string' || text.trim().length === 0 || text.length > MAX_SEARCH_LENGTH) {
        throw new Error(`Search text must be a non-empty string of at most ${MAX_SEARCH_LENGTH} characters`)
    }
}

export function assertExtensionKey(key: unknown): void {
    if (typeof key !== 'string' || key.length === 0 || key.length > MAX_FIELD_LENGTH) {
        throw new Error('Extension targets must be non-empty strings of at most 256 characters')
    }
    if (FORBIDDEN_KEYS.has(key)) throw new Error(`Forbidden extension key: "${key}"`)
}

function checkExtensionValue(value: unknown, depth: number, budget: Budget): void {
    if (depth > MAX_DEPTH) throw new Error(`Extension nesting exceeds ${MAX_DEPTH} levels`)
    spend(budget, 1)
    if (Array.isArray(value)) {
        for (const item of value) checkExtensionValue(item, depth + 1, budget)
        return
    }
    if (value !== null && typeof value === 'object') {
        if (value instanceof Date) {
            if (Number.isNaN(value.getTime())) throw new Error('Extension dates must be valid')
            return
        }
        const prototype = Object.getPrototypeOf(value)
        if (prototype !== Object.prototype && prototype !== null) throw new Error('Extension values must be plain objects')
        for (const key of Object.keys(value)) {
            assertExtensionKey(key)
            checkExtensionValue((value as Record<string, unknown>)[key], depth + 1, budget)
        }
        return
    }
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Extension numbers must be finite')
    if (value !== undefined && value !== null && typeof value !== 'string' && typeof value !== 'boolean' && typeof value !== 'number') {
        throw new Error('Extension values must be JSON-like')
    }
}

export function assertExtensionValue(value: unknown): void {
    checkExtensionValue(value, 0, { nodes: 0 })
}

function spend(
budget: Budget, count: number): void {
    budget.nodes += count
    if (budget.nodes > MAX_NODES) throw new Error(`Query exceeds ${MAX_NODES} nodes`)
}

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
            assertValue(node.operator, node.value)
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
        if (typeof aggregate.type !== 'string' || !AGGREGATES.has(aggregate.type)) {
            throw new Error(`Unknown aggregate type: "${String(aggregate.type)}"`)
        }
        checkFilters(aggregate.filters, depth, budget)
    }
    if (query.search !== undefined) assertSearch(query.search)
    if (query.extensions !== undefined) {
        if (query.extensions === null || typeof query.extensions !== 'object' || Array.isArray(query.extensions)) {
            throw new Error('extensions must be an object')
        }
        for (const key of Object.keys(query.extensions)) {
            assertExtensionKey(key)
            assertExtensionValue(query.extensions[key])
        }
    }
    if (query.limit !== undefined) assertLimit(query.limit)
    if (query.page !== undefined) assertPage(query.page)
}

export function assertQuery(query: Query): void {
    checkQuery(query, 0, { nodes: 0 })
}

import {
    MAX_FIELD_LENGTH,
    MAX_LIMIT,
    MAX_LIST,
    MAX_NODES,
    MAX_PAGE,
    MAX_SEARCH_LENGTH,
    MAX_VALUE_LENGTH,
} from './limits.ts'

const OPERATORS = new Set(['=', '!=', '>', '>=', '<', '<=', 'like', 'not like', 'in', 'not in'])
const DIRECTIONS = new Set(['asc', 'desc'])

export interface Budget {
    nodes: number
}

export function spend(budget: Budget, count: number): void {
    budget.nodes += count
    if (budget.nodes > MAX_NODES) throw new Error(`Query exceeds ${MAX_NODES} nodes`)
}

export function isScalar(value: unknown): boolean {
    if (value === null || value === undefined) return true
    if (typeof value === 'string') return value.length <= MAX_VALUE_LENGTH
    if (typeof value === 'boolean') return true
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

export function assertValue(operator: unknown, value: unknown, budget: Budget = { nodes: 0 }): void {
    assertOperator(operator)
    if (operator === 'in' || operator === 'not in') {
        if (!Array.isArray(value)) throw new Error(`Operator "${operator}" requires an array value`)
        const length = value.length
        if (length > MAX_LIST) throw new Error(`List values are limited to ${MAX_LIST} items`)
        spend(budget, length)
        for (let index = 0; index < length; index++) {
            if (!Object.hasOwn(value, index)) throw new Error('Sparse arrays are not allowed')
            if (!isScalar(value[index])) {
                throw new Error(
                    `List items must be string of at most ${MAX_VALUE_LENGTH} characters, finite number, boolean, null or Date`,
                )
            }
        }
        return
    }
    if (operator === 'like' || operator === 'not like') {
        if (typeof value !== 'string') throw new Error(`Operator "${operator}" requires a string value`)
        if (value.length > MAX_VALUE_LENGTH) throw new Error(`Like patterns are limited to ${MAX_VALUE_LENGTH} characters`)
        return
    }
    if (!isScalar(value)) {
        throw new Error(`Values must be string of at most ${MAX_VALUE_LENGTH} characters, finite number, boolean, null or Date`)
    }
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
    if (page > MAX_PAGE) throw new Error(`page must not exceed ${MAX_PAGE}`)
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

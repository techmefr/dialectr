import { spend } from './assertions.ts'
import type { Budget } from './assertions.ts'
import { MAX_DEPTH, MAX_FIELD_LENGTH, MAX_VALUE_LENGTH } from './limits.ts'

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

export function assertExtensionKey(key: unknown): void {
    if (typeof key !== 'string' || key.length === 0 || key.length > MAX_FIELD_LENGTH) {
        throw new Error('Extension targets must be non-empty strings of at most 256 characters')
    }
    if (FORBIDDEN_KEYS.has(key)) throw new Error(`Forbidden extension key: "${key}"`)
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
}

export function checkExtensionValue(value: unknown, depth: number, budget: Budget): void {
    if (depth > MAX_DEPTH) throw new Error(`Extension nesting exceeds ${MAX_DEPTH} levels`)
    spend(budget, 1)
    if (Array.isArray(value)) {
        const length = value.length
        spend(budget, length)
        for (let index = 0; index < length; index++) {
            if (!Object.hasOwn(value, index)) throw new Error('Sparse arrays are not allowed')
            checkExtensionValue(value[index], depth + 1, budget)
        }
        return
    }
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) throw new Error('Extension dates must be valid')
        return
    }
    if (value !== null && typeof value === 'object') {
        if (!isPlainRecord(value)) throw new Error('Extension values must be plain objects')
        const keys = Object.keys(value)
        spend(budget, keys.length)
        for (const key of keys) {
            assertExtensionKey(key)
            checkExtensionValue(value[key], depth + 1, budget)
        }
        return
    }
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Extension numbers must be finite')
    if (typeof value === 'string' && value.length > MAX_VALUE_LENGTH) {
        throw new Error(`Extension strings are limited to ${MAX_VALUE_LENGTH} characters`)
    }
    if (value !== undefined && value !== null && typeof value !== 'string' && typeof value !== 'boolean' && typeof value !== 'number') {
        throw new Error('Extension values must be JSON-like')
    }
}

export function assertExtensionValue(value: unknown): void {
    checkExtensionValue(value, 0, { nodes: 0 })
}

import { describe, expect, it } from 'vitest'
import { MAX_SEARCH_LENGTH, assertQuery, query } from '../src/index.ts'
import type { Query } from '../src/index.ts'

const raw = (patch: Partial<Query> = {}): Query => ({
    filters: [],
    sorts: [],
    selects: [],
    includes: [],
    aggregates: [],
    ...patch,
})

describe('search', () => {
    it('stores the text on the query', () => {
        expect(query().search('quarterly').build().search).toBe('quarterly')
    })

    it('omits search and extensions by default', () => {
        const built = query().build()
        expect('search' in built).toBe(false)
        expect('extensions' in built).toBe(false)
    })

    it('replaces a previous search', () => {
        expect(query().search('a').search('b').build().search).toBe('b')
    })

    it('rejects empty, blank, non-string and oversized text', () => {
        expect(() => query().search('')).toThrow()
        expect(() => query().search('   ')).toThrow()
        expect(() => query().search(1 as unknown as string)).toThrow()
        expect(() => query().search('x'.repeat(MAX_SEARCH_LENGTH + 1))).toThrow()
        expect(query().search('x'.repeat(MAX_SEARCH_LENGTH)).build().search).toHaveLength(MAX_SEARCH_LENGTH)
    })

    it('is immutable', () => {
        const base = query().where('a', 1)
        const searched = base.search('x')
        expect(base.build().search).toBeUndefined()
        expect(searched).not.toBe(base)
    })

    it('validates hand-made queries', () => {
        expect(() => assertQuery(raw({ search: '' }))).toThrow()
        expect(() => assertQuery(raw({ search: 'ok' }))).not.toThrow()
    })

    it('is validated inside includes', () => {
        const built = query().include('posts', inner => inner.search('hello')).build()
        expect(built.includes[0].query.search).toBe('hello')
        expect(() => assertQuery(raw({ includes: [{ relation: 'p', query: raw({ search: '' }) }] }))).toThrow()
    })
})

describe('extend', () => {
    it('stores a value per target', () => {
        const built = query().extend('lomkit', { scopes: [1] }).extend('strapi', { a: 1 }).build()
        expect(built.extensions).toEqual({ lomkit: { scopes: [1] }, strapi: { a: 1 } })
    })

    it('replaces the value of an existing target', () => {
        expect(query().extend('x', 1).extend('x', 2).build().extensions).toEqual({ x: 2 })
    })

    it('rejects empty and non-string targets', () => {
        expect(() => query().extend('', 1)).toThrow()
        expect(() => query().extend(1 as unknown as string, 1)).toThrow()
        expect(() => query().extend('x'.repeat(257), 1)).toThrow()
    })

    it.each(['__proto__', 'constructor', 'prototype'])('rejects the target "%s"', key => {
        expect(() => query().extend(key, {})).toThrow()
    })

    it('rejects forbidden keys nested in a value', () => {
        expect(() => query().extend('lomkit', JSON.parse('{"__proto__":{"polluted":true}}'))).toThrow()
        expect(() => query().extend('lomkit', { a: [{ constructor: 1 }] })).toThrow()
        expect(() => query().extend('lomkit', { a: { prototype: 1 } })).toThrow()
        expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    })

    it('rejects functions, class instances, NaN and invalid dates', () => {
        expect(() => query().extend('x', () => 1)).toThrow()
        expect(() => query().extend('x', new Map())).toThrow()
        expect(() => query().extend('x', Number.NaN)).toThrow()
        expect(() => query().extend('x', new Date('nope'))).toThrow()
    })

    it('rejects circular values', () => {
        const loop: Record<string, unknown> = {}
        loop.self = loop
        expect(() => query().extend('x', loop)).toThrow()
    })

    it('copies the value defensively on the way in and out', () => {
        const input = { list: [1, 2], when: new Date(0) }
        const builder = query().extend('x', input)
        input.list.push(3)
        input.when.setTime(5)
        const first = builder.build()
        expect(first.extensions).toEqual({ x: { list: [1, 2], when: new Date(0) } })
        ;(first.extensions as { x: { list: number[] } }).x.list.push(9)
        expect(builder.build().extensions).toEqual({ x: { list: [1, 2], when: new Date(0) } })
    })

    it('is immutable', () => {
        const base = query().extend('a', 1)
        const next = base.extend('b', 2)
        expect(base.build().extensions).toEqual({ a: 1 })
        expect(next.build().extensions).toEqual({ a: 1, b: 2 })
    })

    it('validates hand-made queries', () => {
        expect(() => assertQuery(raw({ extensions: JSON.parse('{"__proto__":1}') }))).toThrow()
        expect(() => assertQuery(raw({ extensions: { x: () => 1 } }))).toThrow()
        expect(() => assertQuery(raw({ extensions: [] as unknown as Record<string, unknown> }))).toThrow()
        expect(() => assertQuery(raw({ extensions: { x: { y: 1 } } }))).not.toThrow()
    })
})

describe('to', () => {
    it('runs the compiler on the built query', () => {
        const output = query().where('a', 1).search('x').to(built => ({ count: built.filters.length, text: built.search }))
        expect(output).toEqual({ count: 1, text: 'x' })
    })

    it('validates before compiling', () => {
        let called = false
        expect(() =>
            query().to(built => {
                called = true
                return built
            }),
        ).not.toThrow()
        expect(called).toBe(true)
    })

    it('hands the compiler a copy', () => {
        const builder = query().where('a', 1)
        builder.to(built => built.filters.push({ kind: 'condition', boolean: 'and', field: 'z', operator: '=', value: 1 }))
        expect(builder.build().filters).toHaveLength(1)
    })
})
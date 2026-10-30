import { describe, expect, it, vi } from 'vitest'
import {
    MAX_EXTENSION_KEYS,
    MAX_LIST,
    MAX_NODES,
    MAX_PAGE,
    MAX_VALUE_LENGTH,
    QueryBuilder,
    assertQuery,
    getExtension,
    prepareQuery,
    query,
} from '../src/index.ts'
import type { FilterNode, Query } from '../src/index.ts'

const raw = (patch: Partial<Query> = {}): Query => ({
    filters: [],
    sorts: [],
    selects: [],
    includes: [],
    aggregates: [],
    ...patch,
})

const condition = (value: unknown, operator = '=', field = 'a'): FilterNode => ({
    kind: 'condition',
    boolean: 'and',
    field,
    operator: operator as never,
    value,
})

describe('compiler hand-off', () => {
    it('never calls the compiler when a forged query is invalid', () => {
        const compiler = vi.fn((built: Query) => built)
        const forged = raw({ filters: [condition({ x: 1 })] })
        expect(() => new QueryBuilder(forged).to(compiler)).toThrow('Values must be')
        expect(compiler).not.toHaveBeenCalled()
    })

    it('validates a forged query handed to the constructor', () => {
        expect(() => new QueryBuilder(raw({ limit: -1 }))).toThrow('limit must be')
        expect(() => new QueryBuilder(raw({ filters: [condition(1, 'nope')] }))).toThrow('Unknown operator')
    })

    it('revalidates on build', () => {
        const forged = raw()
        const builder = new QueryBuilder(forged)
        forged.filters.push(condition({ x: 1 }))
        expect(builder.build().filters).toHaveLength(0)
    })
})

describe('snapshot', () => {
    it('is immune to getters that change between reads', () => {
        let reads = 0
        const node = {
            kind: 'condition',
            boolean: 'and',
            field: 'a',
            operator: '=',
            get value() {
                reads++
                return reads === 1 ? 1 : { evil: true }
            },
        } as unknown as FilterNode
        const snapshot = prepareQuery(raw({ filters: [node] }))
        expect(snapshot.filters).toStrictEqual([condition(1)])
        expect(reads).toBe(1)
    })

    it('is immune to proxies that change between reads', () => {
        let reads = 0
        const filters = new Proxy([condition(1)], {
            get(target, key, receiver) {
                if (key === 'length') reads++
                return Reflect.get(target, key, receiver)
            },
        })
        const snapshot = prepareQuery(raw({ filters }))
        reads = 0
        expect(snapshot.filters).toHaveLength(1)
        expect(reads).toBe(0)
    })

    it('returns a detached copy', () => {
        const source = raw({ filters: [condition(1)] })
        const snapshot = assertQuery(source)
        expect(snapshot).not.toBe(source)
        expect(snapshot.filters[0]).not.toBe(source.filters[0])
    })

    it('ignores inherited properties on extensions', () => {
        const extensions = Object.create({ lomkit: { scopes: [] } }) as Record<string, unknown>
        expect(() => prepareQuery(raw({ extensions }))).toThrow('extensions must be an object')
        expect(getExtension(raw({ extensions: {} }), 'toString')).toBeUndefined()
        expect(getExtension(raw({ extensions: { x: 1 } }), 'x')).toBe(1)
    })

    it('rejects extensions that are class instances', () => {
        class Holder {
            lomkit = { scopes: [] }
        }
        expect(() => prepareQuery(raw({ extensions: new Holder() as never }))).toThrow('extensions must be an object')
    })
})

describe('sparse arrays', () => {
    it('rejects holes in list values', () => {
        const sparse = [1, , 2]
        expect(() => query().where('a', 'in', sparse)).toThrow('Sparse arrays')
        expect(() => assertQuery(raw({ filters: [condition(sparse, 'in')] }))).toThrow('Sparse arrays')
    })

    it('rejects holes in structural arrays and extension lists', () => {
        expect(() => assertQuery(raw({ selects: ['a', , 'b'] as string[] }))).toThrow('Sparse arrays')
        expect(() => assertQuery(raw({ extensions: { x: [1, , 2] } }))).toThrow('Sparse arrays')
        expect(() => query().extend('x', [1, , 2])).toThrow('Sparse arrays')
    })
})

describe('amplification limits', () => {
    it('counts list items towards the node budget', () => {
        const half = Array.from({ length: MAX_NODES / 2 + 1 }, (_, index) => index)
        expect(() => assertQuery(raw({ filters: [condition(half, 'in'), condition(half, 'in', 'b')] }))).toThrow('nodes')
        expect(() => assertQuery(raw({ filters: [condition(half, 'in')] }))).not.toThrow()
    })

    it('rejects lists above the maximum length', () => {
        expect(() => query().where('a', 'in', new Array(MAX_LIST + 1).fill(1))).toThrow('List values')
    })

    it('limits the length of string values, list items and like patterns', () => {
        const long = 'x'.repeat(MAX_VALUE_LENGTH + 1)
        expect(() => query().where('a', long)).toThrow('Values must be')
        expect(() => query().where('a', 'in', [long])).toThrow('List items must be')
        expect(() => query().where('a', 'like', long)).toThrow('Like patterns')
        expect(() => query().where('a', 'x'.repeat(MAX_VALUE_LENGTH))).not.toThrow()
    })

    it('limits the number of extension targets', () => {
        const extensions: Record<string, unknown> = {}
        for (let index = 0; index <= MAX_EXTENSION_KEYS; index++) extensions[`t${index}`] = 1
        expect(() => assertQuery(raw({ extensions }))).toThrow('Extensions are limited')
    })

    it('caps the page number', () => {
        expect(() => query().page(MAX_PAGE + 1)).toThrow('page must not exceed')
        expect(() => query().page(MAX_PAGE)).not.toThrow()
        expect(() => assertQuery(raw({ page: MAX_PAGE + 1 }))).toThrow('page must not exceed')
    })

    it('shares one budget between filters, extensions and includes', () => {
        const filters = Array.from({ length: 400 }, () => condition(1))
        const items = Array.from({ length: 400 }, (_, index) => index)
        const inner = raw({ filters })
        expect(() =>
            assertQuery(
                raw({
                    filters,
                    includes: [{ relation: 'p', query: inner }],
                    extensions: { x: items },
                }),
            ),
        ).toThrow('nodes')
        expect(() => assertQuery(raw({ extensions: { a: items, b: items, c: items } }))).toThrow('nodes')
        expect(() => assertQuery(raw({ includes: [{ relation: 'p', query: inner }, { relation: 'q', query: inner }, { relation: 'r', query: inner }] }))).toThrow('nodes')
    })
})

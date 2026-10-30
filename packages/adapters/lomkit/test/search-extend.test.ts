import { query } from 'dialectr'
import type { Query } from 'dialectr'
import { describe, expect, it } from 'vitest'
import { toLomkit } from '../src/index.ts'

const raw = (patch: Partial<Query> = {}): Query => ({
    filters: [],
    sorts: [],
    selects: [],
    includes: [],
    aggregates: [],
    ...patch,
})

describe('toLomkit search and extend', () => {
    it('emits the free text', () => {
        expect(toLomkit(query().search('quarterly').build())).toEqual({ search: { text: { value: 'quarterly' } } })
    })

    it('emits the free text in includes', () => {
        const payload = toLomkit(query().include('posts', inner => inner.search('hi')).build())
        expect(payload.search.includes).toEqual([{ relation: 'posts', text: { value: 'hi' } }])
    })

    it('merges lomkit extensions into the payload', () => {
        const payload = toLomkit(
            query()
                .where('a', 1)
                .extend('lomkit', { scopes: [{ name: 'mine' }], gates: ['view'] })
                .build(),
        )
        expect(payload.search).toEqual({
            filters: [{ field: 'a', operator: '=', value: 1 }],
            scopes: [{ name: 'mine' }],
            gates: ['view'],
        })
    })

    it('ignores extensions aimed at other adapters', () => {
        expect(toLomkit(query().extend('strapi', { anything: 1 }).extend('pocketbase', 2).build())).toEqual({ search: {} })
    })

    it('rejects unknown extension keys and keys that would override the core', () => {
        expect(() => toLomkit(query().extend('lomkit', { filters: [] }).build())).toThrow(/Unsupported lomkit extension key/)
        expect(() => toLomkit(query().extend('lomkit', { limit: 1 }).build())).toThrow()
        expect(() => toLomkit(query().extend('lomkit', { nope: [] }).build())).toThrow()
    })

    it('rejects non-object and non-array extension values', () => {
        expect(() => toLomkit(query().extend('lomkit', 1).build())).toThrow()
        expect(() => toLomkit(query().extend('lomkit', [1]).build())).toThrow()
        expect(() => toLomkit(query().extend('lomkit', { scopes: 'x' }).build())).toThrow()
    })

    it('rejects __proto__ injection through a hand-made query', () => {
        const extensions = JSON.parse('{"lomkit":{"__proto__":{"polluted":true}}}')
        expect(() => toLomkit(raw({ extensions }))).toThrow()
        expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    })

    it('does not alias extension arrays of the builder', () => {
        const builder = query().extend('lomkit', { scopes: [{ name: 'a' }] })
        const payload = toLomkit(builder.build())
        payload.search.scopes?.push('x')
        expect(toLomkit(builder.build()).search.scopes).toEqual([{ name: 'a' }])
    })

    it('works as a compiler through to()', () => {
        expect(query().search('x').to(toLomkit)).toEqual({ search: { text: { value: 'x' } } })
    })
})
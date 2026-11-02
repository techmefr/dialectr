import { query } from 'dialectr'
import { describe, expect, it } from 'vitest'
import { STRAPI_MAX_PAGE_SIZE, toStrapi } from '../src/index.ts'

describe('null filters', () => {
    it('maps = null to $null and != null to $notNull', () => {
        expect(toStrapi(query().where('age', null).build()).filters).toEqual({ age: { $null: true } })
        expect(toStrapi(query().where('age', '!=', null).build()).filters).toEqual({ age: { $notNull: true } })
        expect(toStrapi(query().where('manager.role', null).build()).filters).toEqual({ manager: { role: { $null: true } } })
    })

    it('keeps null inside or groups', () => {
        expect(toStrapi(query().where('a', 1).orWhere('b', null).build()).filters).toEqual({
            $or: [{ a: { $eq: 1 } }, { b: { $null: true } }],
        })
    })

    it('throws on an ordering comparison with null instead of dropping it', () => {
        expect(() => toStrapi(query().where('age', '>', null as never).build())).toThrow('cannot compare null')
    })
})

describe('limit', () => {
    it('accepts up to the Strapi maximum page size', () => {
        expect(STRAPI_MAX_PAGE_SIZE).toBe(100)
        expect(toStrapi(query().limit(100).build()).pagination).toEqual({ pageSize: 100 })
    })

    it('throws above the maximum instead of letting Strapi clamp it', () => {
        expect(() => toStrapi(query().limit(101).build())).toThrow('caps pageSize at 100')
        expect(() => toStrapi(query().include('posts', inner => inner.limit(500)).build())).toThrow('caps pageSize at 100')
    })

    it('accepts a higher maximum for a server that raised it', () => {
        expect(toStrapi(query().limit(500).build(), { maxPageSize: 500 }).pagination).toEqual({ pageSize: 500 })
        expect(() => toStrapi(query().limit(501).build(), { maxPageSize: 500 })).toThrow('caps pageSize at 500')
    })
})

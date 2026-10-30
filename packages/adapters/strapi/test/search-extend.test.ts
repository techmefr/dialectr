import { query } from 'dialectr'
import { describe, expect, it } from 'vitest'
import { toStrapi } from '../src/index.ts'

describe('toStrapi search and extend', () => {
    it('throws on free-text search', () => {
        expect(() => toStrapi(query().search('x').build())).toThrow(/does not support free-text search/)
    })

    it('throws on search inside an include', () => {
        expect(() => toStrapi(query().include('posts', inner => inner.search('x')).build())).toThrow()
    })

    it('throws on an extension aimed at strapi', () => {
        expect(() => toStrapi(query().extend('strapi', { a: 1 }).build())).toThrow(/does not support extensions/)
    })

    it('throws on a strapi extension inside an include', () => {
        expect(() => toStrapi(query().include('posts', inner => inner.extend('strapi', 1)).build())).toThrow()
    })

    it('ignores extensions aimed at other adapters', () => {
        expect(toStrapi(query().where('a', 1).extend('lomkit', { scopes: [] }).build())).toEqual({
            filters: { a: { $eq: 1 } },
        })
    })

    it('works as a compiler through to()', () => {
        expect(query().where('a', 1).to(toStrapi)).toEqual({ filters: { a: { $eq: 1 } } })
    })
})
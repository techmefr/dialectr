import { query } from 'dialectr'
import { describe, expect, it } from 'vitest'
import { toStrapi } from '../src/index.ts'

describe('toStrapi search and extend', () => {
    it('throws on free-text search', () => {
        expect(() => toStrapi(query().search('x').build())).toThrow(/does not support free-text search/)
    })

    it('throws on search inside an include', () => {
        expect(() => toStrapi(query().include('posts', inner => inner.search('x')).build())).toThrow(/does not support free-text search/)
    })

    it('throws on an aggregate inside an include instead of dropping it', () => {
        expect(() => toStrapi(query().include('posts', inner => inner.aggregate('count', 'likes')).build())).toThrow(
            /does not support aggregates/,
        )
    })

    it('ignores extensions of other adapters inside an include', () => {
        expect(toStrapi(query().include('posts', inner => inner.extend('lomkit', { scopes: [] })).build())).toEqual({
            populate: ['posts'],
        })
    })

    it('throws on an extension aimed at strapi', () => {
        expect(() => toStrapi(query().extend('strapi', { a: 1 }).build())).toThrow(/does not support extensions/)
    })

    it('throws on a strapi extension inside an include', () => {
        expect(() => toStrapi(query().include('posts', inner => inner.extend('strapi', 1)).build())).toThrow(/does not support extensions/)
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
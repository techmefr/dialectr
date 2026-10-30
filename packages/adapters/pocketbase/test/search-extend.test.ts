import { query } from 'dialectr'
import { describe, expect, it } from 'vitest'
import { toPocketbase } from '../src/index.ts'

describe('toPocketbase search and extend', () => {
    it('throws on free-text search', () => {
        expect(() => toPocketbase(query().search('x').build())).toThrow(/does not support free-text search/)
    })

    it('throws on search inside an include', () => {
        expect(() => toPocketbase(query().include('posts', inner => inner.search('x')).build())).toThrow()
    })

    it('throws on an extension aimed at pocketbase', () => {
        expect(() => toPocketbase(query().extend('pocketbase', { a: 1 }).build())).toThrow(/does not support extensions/)
    })

    it('ignores extensions aimed at other adapters', () => {
        expect(toPocketbase(query().where('a', 1).extend('lomkit', { scopes: [] }).extend('strapi', 1).build())).toEqual({
            filter: "a=1",
        })
    })

    it('works as a compiler through to()', () => {
        expect(query().where('a', 1).to(toPocketbase)).toEqual({ filter: 'a=1' })
    })
})
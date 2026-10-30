import { query } from 'dialectr'
import { describe, expect, it } from 'vitest'
import { toStrapi } from '../src/index.ts'

describe('toStrapi', () => {
    it('returns no params for an empty query', () => {
        expect(toStrapi(query().build())).toEqual({})
    })

    it('maps a single condition without wrapping', () => {
        expect(toStrapi(query().where('age', '>=', 18).build()).filters).toEqual({ age: { $gte: 18 } })
    })

    it('combines AND and OR with SQL precedence', () => {
        const { filters } = toStrapi(query().where('a', 1).where('b', 2).orWhere('c', 3).build())
        expect(filters).toEqual({
            $or: [{ $and: [{ a: { $eq: 1 } }, { b: { $eq: 2 } }] }, { c: { $eq: 3 } }],
        })
    })

    it('nests relation paths', () => {
        expect(toStrapi(query().where('author.name', 'Ann').build()).filters).toEqual({
            author: { name: { $eq: 'Ann' } },
        })
    })

    it('maps like to case-insensitive operators', () => {
        const filter = (value: string) => toStrapi(query().where('t', 'like', value).build()).filters
        expect(filter('%x%')).toEqual({ t: { $containsi: 'x' } })
        expect(filter('x%')).toEqual({ t: { $startsWithi: 'x' } })
        expect(filter('%x')).toEqual({ t: { $endsWithi: 'x' } })
        expect(toStrapi(query().where('t', 'not like', '%x%').build()).filters).toEqual({
            t: { $not: { $containsi: 'x' } },
        })
    })

    it('maps in and not in', () => {
        expect(toStrapi(query().where('id', 'in', [1, 2]).build()).filters).toEqual({ id: { $in: [1, 2] } })
        expect(toStrapi(query().where('id', 'not in', [1]).build()).filters).toEqual({ id: { $notIn: [1] } })
    })

    it('maps sort, fields and pagination', () => {
        const params = toStrapi(query().sort('name', 'desc').select('id').limit(5).page(2).build())
        expect(params).toEqual({
            sort: ['name:desc'],
            fields: ['id'],
            pagination: { page: 2, pageSize: 5 },
        })
    })

    it('uses a flat populate list for plain includes and an object otherwise', () => {
        expect(toStrapi(query().include('author').build()).populate).toEqual(['author'])
        expect(toStrapi(query().include('posts', builder => builder.where('t', 'x')).build()).populate).toEqual({
            posts: { filters: { t: { $eq: 'x' } } },
        })
    })

    it('refuses aggregates', () => {
        expect(() => toStrapi(query().aggregate('count', 'posts').build())).toThrow('aggregates')
    })
})

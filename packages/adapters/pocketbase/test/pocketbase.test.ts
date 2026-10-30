import { query } from 'dialectr'
import { describe, expect, it } from 'vitest'
import { toPocketbase } from '../src/index.ts'

describe('toPocketbase', () => {
    it('returns no params for an empty query', () => {
        expect(toPocketbase(query().build())).toEqual({})
    })

    it('builds a filter with AND, OR precedence and groups', () => {
        const params = toPocketbase(
            query()
                .where('age', '>=', 18)
                .where('name', 'like', 'A%')
                .orWhere('city', 'Paris')
                .build(),
        )
        expect(params.filter).toBe("(age>=18 && name~'A%') || (city='Paris')")
    })

    it('nests groups in parentheses', () => {
        const params = toPocketbase(
            query()
                .where('a', 1)
                .whereGroup(group => group.where('b', 2).orWhere('c', 3))
                .build(),
        )
        expect(params.filter).toBe('a=1 && ((b=2) || (c=3))')
    })

    it('expands in and not in', () => {
        expect(toPocketbase(query().where('id', 'in', ['a', 'b']).build()).filter).toBe("(id='a' || id='b')")
        expect(toPocketbase(query().where('id', 'not in', [1, 2]).build()).filter).toBe('(id!=1 && id!=2)')
        expect(toPocketbase(query().where('id', 'in', []).build()).filter).toBe('false')
    })

    it('escapes quotes and backslashes in string values', () => {
        const params = toPocketbase(query().where('name', "O'Neil\\").build())
        expect(params.filter).toBe("name='O\\'Neil\\\\'")
    })

    it('rejects field names that could break the filter', () => {
        expect(() => toPocketbase(query().where('a=1 || b', 1).build())).toThrow('Unsupported field name')
    })

    it('maps sort, fields, expand and pagination', () => {
        const params = toPocketbase(
            query().sort('name', 'desc').sort('id').select('id', 'name').include('author').limit(5).page(2).build(),
        )
        expect(params).toEqual({ sort: '-name,id', fields: 'id,name', expand: 'author', page: 2, perPage: 5 })
    })

    it('refuses aggregates', () => {
        expect(() => toPocketbase(query().aggregate('count', 'posts').build())).toThrow('aggregates')
    })
})

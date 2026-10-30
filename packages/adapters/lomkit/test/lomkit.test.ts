import { query } from 'dialectr'
import { describe, expect, it } from 'vitest'
import { toLomkit } from '../src/index.ts'

describe('toLomkit', () => {
    it('wraps an empty query in a search key', () => {
        expect(toLomkit(query().build())).toEqual({ search: {} })
    })

    it('maps filters, or-type and nested groups', () => {
        const payload = toLomkit(
            query()
                .where('age', '>', 18)
                .orWhere('name', 'like', 'A%')
                .whereGroup(group => group.where('city', 'Paris').orWhere('city', 'Lyon'))
                .build(),
        )
        expect(payload.search.filters).toEqual([
            { field: 'age', operator: '>', value: 18 },
            { field: 'name', operator: 'like', value: 'A%', type: 'or' },
            { nested: [{ field: 'city', operator: '=', value: 'Paris' }, { field: 'city', operator: '=', value: 'Lyon', type: 'or' }] },
        ])
    })

    it('never marks the first filter as or', () => {
        const payload = toLomkit(query().orWhere('a', 1).build())
        expect(payload.search.filters).toEqual([{ field: 'a', operator: '=', value: 1 }])
    })

    it('maps sorts, selects, includes, aggregates and pagination', () => {
        const payload = toLomkit(
            query()
                .sort('name', 'desc')
                .select('id', 'name')
                .include('posts', builder => builder.where('title', 'x').limit(2))
                .aggregate('max', 'stars', { field: 'rate' })
                .limit(10)
                .page(3)
                .build(),
        )
        expect(payload.search).toEqual({
            sorts: [{ field: 'name', direction: 'desc' }],
            selects: [{ field: 'id' }, { field: 'name' }],
            includes: [{ relation: 'posts', filters: [{ field: 'title', operator: '=', value: 'x' }], limit: 2 }],
            aggregates: [{ relation: 'stars', type: 'max', field: 'rate' }],
            limit: 10,
            page: 3,
        })
    })
})

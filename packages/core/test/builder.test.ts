import { describe, expect, it } from 'vitest'
import { groupByOr, query } from '../src/index.ts'

interface User {
    id: number
    name: string
    age: number
}

describe('query builder', () => {
    it('starts empty', () => {
        expect(query().build()).toEqual({ filters: [], sorts: [], selects: [], includes: [], aggregates: [] })
    })

    it('where(field, value) defaults to equality', () => {
        const built = query<User>().where('name', 'Ann').build()
        expect(built.filters).toEqual([
            { kind: 'condition', boolean: 'and', field: 'name', operator: '=', value: 'Ann' },
        ])
    })

    it('where(field, operator, value) and orWhere', () => {
        const built = query<User>().where('age', '>=', 18).orWhere('name', 'like', 'A%').build()
        expect(built.filters.map(node => node.boolean)).toEqual(['and', 'or'])
    })

    it('is immutable: each call returns a new builder', () => {
        const base = query<User>().where('id', 1)
        const extended = base.sort('name', 'desc')
        expect(base.build().sorts).toEqual([])
        expect(extended.build().sorts).toEqual([{ field: 'name', direction: 'desc' }])
    })

    it('build() returns a copy that cannot mutate the builder', () => {
        const builder = query<User>().where('id', 1)
        builder.build().filters.length = 0
        expect(builder.build().filters).toHaveLength(1)
    })

    it('groups nested conditions and skips empty groups', () => {
        const built = query<User>()
            .where('age', '>', 1)
            .orWhereGroup(group => group.where('name', 'Ann').where('age', '<', 5))
            .whereGroup(group => group)
            .build()
        expect(built.filters).toHaveLength(2)
        expect(built.filters[1]).toMatchObject({ kind: 'group', boolean: 'or' })
    })

    it('records selects, includes, aggregates, limit and page', () => {
        const built = query<User>()
            .select('id', 'name')
            .include('posts', builder => builder.where('title', 'x').limit(2))
            .aggregate('count', 'posts', { where: builder => builder.where('published', true) })
            .limit(10)
            .page(2)
            .build()
        expect(built.selects).toEqual(['id', 'name'])
        expect(built.includes[0].relation).toBe('posts')
        expect(built.includes[0].query.limit).toBe(2)
        expect(built.aggregates[0]).toMatchObject({ type: 'count', relation: 'posts' })
        expect(built.limit).toBe(10)
        expect(built.page).toBe(2)
    })

    it('rejects unknown operators, non-array in, and bad pagination', () => {
        expect(() => query().where('a', '~~' as never, 1)).toThrow('Unknown operator')
        expect(() => query().where('a', 'in', 1)).toThrow('requires an array')
        expect(() => query().limit(0)).toThrow()
        expect(() => query().page(1.5)).toThrow()
    })
})

describe('groupByOr', () => {
    it('applies AND-before-OR precedence', () => {
        const { filters } = query()
            .where('a', 1)
            .where('b', 2)
            .orWhere('c', 3)
            .build()
        expect(groupByOr(filters).map(cluster => cluster.length)).toEqual([2, 1])
    })

    it('returns no cluster for an empty list', () => {
        expect(groupByOr([])).toEqual([])
    })
})

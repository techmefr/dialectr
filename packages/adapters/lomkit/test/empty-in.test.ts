import { query } from 'dialectr'
import { describe, expect, it } from 'vitest'
import { toLomkit } from '../src/index.ts'

const filters = (build: ReturnType<typeof query>) => toLomkit(build.build()).search.filters

describe('empty in and not in', () => {
    it('sends in [] as a list holding null and drops not in []', () => {
        expect(filters(query().where('id', 'in', []))).toEqual([{ field: 'id', operator: 'in', value: [null] }])
        expect(filters(query().where('id', 'not in', []))).toBeUndefined()
    })

    it('combines with and, or and groups', () => {
        expect(filters(query().where('a', 1).orWhere('id', 'in', []))).toEqual([
            { field: 'a', operator: '=', value: 1 },
            { field: 'id', operator: 'in', value: [null], type: 'or' },
        ])
        expect(filters(query().where('a', 1).whereGroup(group => group.where('id', 'in', []).orWhere('b', 2)))).toEqual([
            { field: 'a', operator: '=', value: 1 },
            {
                nested: [
                    { field: 'id', operator: 'in', value: [null] },
                    { field: 'b', operator: '=', value: 2, type: 'or' },
                ],
            },
        ])
    })

    it('removes not in [] from an and chain', () => {
        expect(filters(query().where('a', 1).where('id', 'not in', []).where('b', 2))).toEqual([
            { field: 'a', operator: '=', value: 1 },
            { field: 'b', operator: '=', value: 2 },
        ])
    })

    it('makes the whole expression true when not in [] sits in an or cluster', () => {
        expect(filters(query().where('a', 1).orWhere('id', 'not in', []))).toBeUndefined()
        expect(filters(query().where('id', 'not in', []).orWhere('a', 1))).toBeUndefined()
    })

    it('keeps the other or clusters when only an and cluster loses a condition', () => {
        expect(filters(query().where('a', 1).where('id', 'not in', []).orWhere('b', 2))).toEqual([
            { field: 'a', operator: '=', value: 1 },
            { field: 'b', operator: '=', value: 2, type: 'or' },
        ])
        expect(filters(query().where('id', 'not in', []).where('a', 1).orWhere('b', 2))).toEqual([
            { field: 'a', operator: '=', value: 1 },
            { field: 'b', operator: '=', value: 2, type: 'or' },
        ])
    })

    it('treats a group that is always true as a dropped condition or a true cluster', () => {
        expect(filters(query().where('a', 1).whereGroup(group => group.where('id', 'not in', [])))).toEqual([
            { field: 'a', operator: '=', value: 1 },
        ])
        expect(filters(query().where('a', 1).orWhereGroup(group => group.where('id', 'not in', []).orWhere('b', 2)))).toBeUndefined()
        expect(filters(query().where('a', 1).whereGroup(group => group.where('id', 'not in', []).where('b', 2)))).toEqual([
            { field: 'a', operator: '=', value: 1 },
            { nested: [{ field: 'b', operator: '=', value: 2 }] },
        ])
    })

    it('applies to includes and aggregate filters', () => {
        const payload = toLomkit(
            query()
                .include('posts', inner => inner.where('id', 'not in', []))
                .aggregate('count', 'posts', { where: inner => inner.where('id', 'in', []) })
                .build(),
        )
        expect(payload.search.includes).toEqual([{ relation: 'posts' }])
        expect(payload.search.aggregates).toEqual([
            { relation: 'posts', type: 'count', filters: [{ field: 'id', operator: 'in', value: [null] }] },
        ])
    })
})

import { query } from 'dialectr'
import { describe, expect, it } from 'vitest'
import { toLomkit } from '../src/index.ts'

const filters = (build: ReturnType<typeof query>) => toLomkit(build.build()).search.filters

describe('empty in and not in', () => {
    it('keeps the empty list', () => {
        expect(filters(query().where('id', 'in', []))).toEqual([{ field: 'id', operator: 'in', value: [] }])
        expect(filters(query().where('id', 'not in', []))).toEqual([{ field: 'id', operator: 'not in', value: [] }])
    })

    it('combines with and, or and groups', () => {
        expect(filters(query().where('a', 1).orWhere('id', 'in', []))).toEqual([
            { field: 'a', operator: '=', value: 1 },
            { field: 'id', operator: 'in', value: [], type: 'or' },
        ])
        expect(filters(query().where('a', 1).whereGroup(group => group.where('id', 'not in', []).orWhere('b', 2)))).toEqual([
            { field: 'a', operator: '=', value: 1 },
            {
                nested: [
                    { field: 'id', operator: 'not in', value: [] },
                    { field: 'b', operator: '=', value: 2, type: 'or' },
                ],
            },
        ])
    })
})

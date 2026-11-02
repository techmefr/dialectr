import { query } from 'dialectr'
import { describe, expect, it } from 'vitest'
import { toStrapi } from '../src/index.ts'

const filters = (build: ReturnType<typeof query>) => toStrapi(build.build()).filters

describe('empty in and not in', () => {
    it('keeps the empty list', () => {
        expect(filters(query().where('id', 'in', []))).toEqual({ id: { $in: [] } })
        expect(filters(query().where('id', 'not in', []))).toEqual({ id: { $notIn: [] } })
    })

    it('combines with and, or and groups', () => {
        expect(filters(query().where('a', 1).where('id', 'in', []))).toEqual({
            $and: [{ a: { $eq: 1 } }, { id: { $in: [] } }],
        })
        expect(filters(query().where('a', 1).orWhere('id', 'not in', []))).toEqual({
            $or: [{ a: { $eq: 1 } }, { id: { $notIn: [] } }],
        })
        expect(filters(query().where('a', 1).whereGroup(group => group.where('id', 'in', []).orWhere('b', 2)))).toEqual({
            $and: [{ a: { $eq: 1 } }, { $or: [{ id: { $in: [] } }, { b: { $eq: 2 } }] }],
        })
    })
})

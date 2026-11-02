import { query } from 'dialectr'
import { describe, expect, it } from 'vitest'
import { toStrapi } from '../src/index.ts'

const filters = (build: ReturnType<typeof query>) => toStrapi(build.build()).filters

const never = (field: string) => ({ $and: [{ [field]: { $null: true } }, { [field]: { $notNull: true } }] })

describe('empty in and not in', () => {
    it('compiles in [] to a condition that matches nothing and drops not in []', () => {
        expect(filters(query().where('id', 'in', []))).toEqual(never('id'))
        expect(filters(query().where('id', 'not in', []))).toBeUndefined()
    })

    it('combines with and, or and groups', () => {
        expect(filters(query().where('a', 1).where('id', 'in', []))).toEqual({
            $and: [{ a: { $eq: 1 } }, never('id')],
        })
        expect(filters(query().where('a', 1).where('id', 'not in', []))).toEqual({ a: { $eq: 1 } })
        expect(filters(query().where('a', 1).orWhere('id', 'not in', []))).toBeUndefined()
        expect(filters(query().where('a', 1).whereGroup(group => group.where('id', 'in', []).orWhere('b', 2)))).toEqual({
            $and: [{ a: { $eq: 1 } }, { $or: [never('id'), { b: { $eq: 2 } }] }],
        })
        expect(filters(query().where('a', 1).whereGroup(group => group.where('id', 'not in', []).orWhere('b', 2)))).toEqual({
            a: { $eq: 1 },
        })
    })

    it('nests the never condition under a relation path', () => {
        expect(filters(query().where('manager.role', 'in', []))).toEqual({
            $and: [{ manager: { role: { $null: true } } }, { manager: { role: { $notNull: true } } }],
        })
    })
})

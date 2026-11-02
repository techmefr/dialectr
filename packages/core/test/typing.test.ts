import { describe, expect, expectTypeOf, it } from 'vitest'
import { query } from '../src/index.ts'
import type { Field, FieldValue } from '../src/index.ts'

interface User {
    id: number
    name: string
    age: number
    active: boolean
    nickname?: string
}

describe('filter value typing', () => {
    it('types the value by field', () => {
        expectTypeOf<FieldValue<User, 'age'>>().toEqualTypeOf<number>()
        expectTypeOf<FieldValue<User, 'nickname'>>().toEqualTypeOf<string>()
        expectTypeOf<Field<User>>().toEqualTypeOf<'id' | 'name' | 'age' | 'active' | 'nickname'>()
        query<User>().where('age', 3).where('age', '>=', 18).where('name', 'Ann').where('active', true)
        query<User>().orWhere('age', '<', 4).orWhere('name', '!=', 'Bob')
        expect(query<User>().where('age', '>=', 18).build().filters).toHaveLength(1)
    })

    it('rejects a value of the wrong type', () => {
        expect(() => {
            // @ts-expect-error
            query<User>().where('age', '>=', 'abc')
        }).not.toThrow()
        expect(() => {
            // @ts-expect-error
            query<User>().where('name', 5)
        }).not.toThrow()
        expect(() => {
            // @ts-expect-error
            query<User>().orWhere('active', 'yes')
        }).not.toThrow()
    })

    it('types in and not in as a list of the field type', () => {
        query<User>().where('age', 'in', [1, 2]).where('name', 'not in', ['a'])
        expect(() => {
            // @ts-expect-error
            query<User>().where('age', 'in', ['a'])
        }).not.toThrow()
        expect(() => {
            // @ts-expect-error
            query<User>().where('age', 'in', 1)
        }).toThrow()
    })

    it('types like and not like as a string', () => {
        query<User>().where('name', 'like', 'A%').orWhere('age', 'not like', '1%')
        expect(() => {
            // @ts-expect-error
            query<User>().where('name', 'like', 5)
        }).toThrow()
    })

    it('rejects an unknown field of a known type', () => {
        expect(() => {
            // @ts-expect-error
            query<User>().where('missing', 1)
        }).not.toThrow()
    })

    it('stays permissive when the type is not given', () => {
        query().where('anything', 'abc').where('n', '>=', 1).where('x', 'in', [1, 'a', null]).where('y', 'like', 'a%')
        query().where('a.b', 1)
        expect(query().where('a.b', 'x').build().filters).toHaveLength(1)
    })
})

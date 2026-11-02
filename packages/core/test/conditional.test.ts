import { describe, expect, expectTypeOf, it } from 'vitest'
import { query } from '../src/index.ts'

interface Filters {
    status?: string
    ids?: number[]
    q?: string
}

interface Row {
    status: string
    id: number
    name: string
}

describe('when', () => {
    it('applies the callback when the condition is truthy', () => {
        const built = query<Row>().when(true, builder => builder.where('status', 'open')).build()
        expect(built.filters).toHaveLength(1)
    })

    it('skips the callback when the condition is falsy', () => {
        for (const condition of [false, 0, '', null, undefined]) {
            let called = false
            const built = query<Row>()
                .when(condition, builder => {
                    called = true
                    return builder.where('status', 'open')
                })
                .build()
            expect(called).toBe(false)
            expect(built.filters).toEqual([])
        }
    })

    it('passes the truthy value to the callback', () => {
        const filters: Filters = { status: 'open' }
        const built = query<Row>()
            .when(filters.status, (builder, status) => {
                expectTypeOf(status).toEqualTypeOf<string>()
                return builder.where('status', status)
            })
            .build()
        expect(built.filters).toMatchObject([{ field: 'status', value: 'open' }])
    })

    it('stays immutable', () => {
        const base = query<Row>().where('id', 1)
        const next = base.when(true, builder => builder.where('status', 'open'))
        expect(base.build().filters).toHaveLength(1)
        expect(next.build().filters).toHaveLength(2)
    })

    it('throws when the callback does not chain the builder', () => {
        expect(() => query<Row>().when(true, builder => builder)).toThrow(/chain the builder/)
        expect(() => query<Row>().when(true, (() => undefined) as never)).toThrow(/chain the builder/)
    })

    it('chains several conditional filters', () => {
        const filters: Filters = { status: 'open', ids: [], q: undefined }
        const built = query<Row>()
            .when(filters.status, (builder, status) => builder.where('status', status))
            .when(filters.ids?.length, builder => builder.where('id', 'in', filters.ids ?? []))
            .build()
        expect(built.filters).toHaveLength(1)
    })
})

describe('whereIf', () => {
    it('skips undefined, null, empty strings and empty arrays', () => {
        const built = query<Row>()
            .whereIf('status', undefined)
            .whereIf('status', null)
            .whereIf('name', '')
            .whereIf('name', 'like', '')
            .whereIf('id', 'in', [])
            .whereIf('id', 'not in', undefined)
            .whereIf('id', '>=', null)
            .build()
        expect(built.filters).toEqual([])
    })

    it('adds the filter when the value is present', () => {
        const built = query<Row>()
            .whereIf('status', 'open')
            .whereIf('id', '>=', 3)
            .whereIf('id', 'in', [1, 2])
            .whereIf('name', 'like', 'ann')
            .build()
        expect(built.filters).toEqual(
            query<Row>().where('status', 'open').where('id', '>=', 3).where('id', 'in', [1, 2]).where('name', 'like', 'ann').build().filters,
        )
    })

    it('keeps 0 and false as real values', () => {
        interface Flags {
            count: number
            active: boolean
        }
        const built = query<Flags>().whereIf('count', 0).whereIf('active', false).build()
        expect(built.filters).toHaveLength(2)
    })

    it('keeps the current meaning of an empty in list on where', () => {
        const built = query<Row>().where('id', 'in', []).build()
        expect(built.filters).toMatchObject([{ operator: 'in', value: [] }])
    })

    it('still validates a present value', () => {
        expect(() => query<Row>().whereIf('id', 'in', 'x' as never)).toThrow(/requires an array/)
    })

    it('orWhereIf follows the same rules', () => {
        const built = query<Row>().where('id', 1).orWhereIf('status', undefined).orWhereIf('status', 'open').build()
        expect(built.filters).toHaveLength(2)
        expect(built.filters[1]).toMatchObject({ boolean: 'or', field: 'status' })
    })

    it('rejects a wrong value type at compile time', () => {
        expect(() => {
            // @ts-expect-error
            query<Row>().whereIf('id', '>=', 'abc')
        }).not.toThrow()
    })
})

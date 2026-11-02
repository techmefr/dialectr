import { query } from 'dialectr'
import { describe, expect, it } from 'vitest'
import { toPocketbase } from '../src/index.ts'

const filter = (build: ReturnType<typeof query>) => toPocketbase(build.build()).filter

describe('empty in and not in', () => {
    it('emits expressions PocketBase accepts', () => {
        expect(filter(query().where('id', 'in', []))).toBe('1=0')
        expect(filter(query().where('id', 'not in', []))).toBe('1=1')
    })

    it('combines with and', () => {
        expect(filter(query().where('a', 1).where('id', 'in', []))).toBe('a=1 && 1=0')
        expect(filter(query().where('a', 1).where('id', 'not in', []))).toBe('a=1 && 1=1')
    })

    it('combines with or', () => {
        expect(filter(query().where('a', 1).orWhere('id', 'in', []))).toBe('(a=1) || (1=0)')
        expect(filter(query().where('id', 'not in', []).orWhere('a', 1))).toBe('(1=1) || (a=1)')
    })

    it('works inside groups', () => {
        expect(filter(query().where('a', 1).whereGroup(group => group.where('id', 'in', []).orWhere('b', 2)))).toBe(
            'a=1 && ((1=0) || (b=2))',
        )
        expect(filter(query().where('a', 1).orWhereGroup(group => group.where('id', 'not in', []).where('b', 2)))).toBe(
            '(a=1) || ((1=1 && b=2))',
        )
    })

    it('never emits a bare boolean literal', () => {
        const output = filter(query().where('id', 'in', []).orWhere('x', 'not in', []))
        expect(output).not.toMatch(/(^|[^=\w])(true|false)([^=\w]|$)/)
    })
})

describe('date strings', () => {
    it('keeps ISO strings as given and only normalises Date values', () => {
        expect(filter(query().where('d', '<', '2024-03-01T00:00:00.000Z'))).toBe("d<'2024-03-01T00:00:00.000Z'")
        expect(filter(query().where('d', '<', new Date('2024-03-01T00:00:00.000Z')))).toBe("d<'2024-03-01 00:00:00.000Z'")
    })
})

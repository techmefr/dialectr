import packageJson from '../package.json'
import { describe, expect, it } from 'vitest'
import {
    MAX_DEPTH,
    MAX_LIMIT,
    MAX_NODES,
    assertQuery,
    containsPattern,
    escapeLike,
    parseLike,
    query,
} from '../src/index.ts'
import type { FilterNode, Query, QueryBuilder } from '../src/index.ts'

const raw = (patch: Partial<Query> = {}): Query => ({
    filters: [],
    sorts: [],
    selects: [],
    includes: [],
    aggregates: [],
    ...patch,
})

const deep =
    (levels: number) =>
    (builder: QueryBuilder): QueryBuilder =>
        levels === 0 ? builder.where('a', 1) : builder.whereGroup(deep(levels - 1))

const deepNodes = (levels: number): FilterNode[] => {
    let nodes: FilterNode[] = [{ kind: 'condition', boolean: 'and', field: 'a', operator: '=', value: 1 }]
    for (let index = 0; index < levels; index++) nodes = [{ kind: 'group', boolean: 'and', nodes }]
    return nodes
}

describe('validation', () => {
    it('rejects a sort direction outside asc and desc at runtime', () => {
        expect(() => query().sort('a', 'sideways' as never)).toThrow('Sort direction')
        expect(() => query().sort('a', undefined as never).build()).not.toThrow()
    })

    it('rejects limits above the maximum', () => {
        expect(() => query().limit(MAX_LIMIT)).not.toThrow()
        expect(() => query().limit(MAX_LIMIT + 1)).toThrow('must not exceed')
    })

    it('rejects non-scalar and non-finite values', () => {
        expect(() => query().where('a', { $gt: 1 })).toThrow('Values must be')
        expect(() => query().where('a', [1])).toThrow('Values must be')
        expect(() => query().where('a', Number.NaN)).toThrow('Values must be')
        expect(() => query().where('a', Number.POSITIVE_INFINITY)).toThrow('Values must be')
        expect(() => query().where('a', () => 1)).toThrow('Values must be')
        expect(() => query().where('a', new Date('nope'))).toThrow('Values must be')
        expect(() => query().where('a', 'in', [{}])).toThrow('List items')
        expect(() => query().where('a', 'like', 1)).toThrow('requires a string')
    })

    it('accepts null, undefined, Date and booleans', () => {
        expect(() => query().where('a', null).where('b', undefined).where('c', new Date()).where('d', false)).not.toThrow()
    })

    it('rejects hand-made queries with unknown operators', () => {
        for (const operator of ['__proto__', 'constructor', 'toString', undefined]) {
            const filters: FilterNode[] = [
                { kind: 'condition', boolean: 'and', field: 'a', operator: operator as never, value: 1 },
            ]
            expect(() => assertQuery(raw({ filters }))).toThrow('Unknown operator')
        }
    })

    it('rejects empty groups, bad directions, bad aggregates and bad selects in hand-made queries', () => {
        expect(() => assertQuery(raw({ filters: [{ kind: 'group', boolean: 'and', nodes: [] }] }))).toThrow(
            'Empty filter group',
        )
        expect(() => assertQuery(raw({ sorts: [{ field: 'a', direction: 'up' as never }] }))).toThrow('Sort direction')
        expect(() =>
            assertQuery(raw({ aggregates: [{ type: 'median' as never, relation: 'r', filters: [] }] })),
        ).toThrow('aggregate type')
        expect(() => assertQuery(raw({ selects: [123 as never] }))).toThrow('Field names')
        expect(() => assertQuery(raw({ selects: [''] }))).toThrow('Field names')
        expect(() => assertQuery(raw({ limit: MAX_LIMIT + 1 }))).toThrow('must not exceed')
    })
})

describe('bounds', () => {
    it('allows nested groups up to the maximum depth', () => {
        expect(() => query().whereGroup(deep(MAX_DEPTH - 1)).build()).not.toThrow()
    })

    it('rejects nesting above the maximum depth', () => {
        expect(() => query().whereGroup(deep(MAX_DEPTH)).build()).toThrow('nesting')
        expect(() => assertQuery(raw({ filters: deepNodes(MAX_DEPTH + 50) }))).toThrow('nesting')
    })

    it('rejects nested includes above the maximum depth', () => {
        let nested: Query = raw()
        for (let index = 0; index < MAX_DEPTH + 2; index++) {
            nested = raw({ includes: [{ relation: 'r', query: nested }] })
        }
        expect(() => assertQuery(nested)).toThrow('nesting')
    })

    it('rejects queries with too many nodes', () => {
        let builder = query()
        for (let index = 0; index < MAX_NODES + 1; index++) builder = builder.where('a', index)
        expect(() => builder.build()).toThrow('nodes')
    })

    it('builds nested groups three levels deep', () => {
        const built = query()
            .where('a', 1)
            .whereGroup(group =>
                group.where('b', 2).orWhereGroup(inner => inner.where('c', 3).whereGroup(last => last.where('d', 4))),
            )
            .build()
        const level1 = built.filters[1]
        expect(level1.kind === 'group' && level1.nodes[1].kind === 'group').toBe(true)
    })
})

describe('immutability', () => {
    it('copies in-lists so later mutation does not reach the builder', () => {
        const ids = [1, 2]
        const builder = query().where('id', 'in', ids)
        ids.push(3)
        expect(builder.build().filters[0]).toMatchObject({ value: [1, 2] })
    })

    it('copies values handed out by build()', () => {
        const builder = query().where('id', 'in', [1, 2]).where('at', new Date(0))
        const built = builder.build()
        const [first, second] = built.filters
        if (first.kind === 'condition') (first.value as number[]).push(9)
        if (second.kind === 'condition') (second.value as Date).setTime(5)
        const again = builder.build()
        expect(again.filters[0]).toMatchObject({ value: [1, 2] })
        expect((again.filters[1] as { value: Date }).value.getTime()).toBe(0)
    })

    it('copies Date values passed in', () => {
        const date = new Date(0)
        const builder = query().where('at', date)
        date.setTime(10)
        expect((builder.build().filters[0] as { value: Date }).value.getTime()).toBe(0)
    })
})

describe('like helpers', () => {
    it('escapes wildcards and backslashes', () => {
        expect(escapeLike('100%_\\')).toBe('100\\%\\_\\\\')
    })

    it('parses leading, trailing and inner wildcards', () => {
        expect(parseLike('%x%')).toEqual({ literal: 'x', leading: true, trailing: true, inner: false })
        expect(parseLike('x%')).toEqual({ literal: 'x', leading: false, trailing: true, inner: false })
        expect(parseLike('%x')).toEqual({ literal: 'x', leading: true, trailing: false, inner: false })
        expect(parseLike('a%b').inner).toBe(true)
        expect(parseLike('a_b').inner).toBe(true)
        expect(parseLike('%')).toMatchObject({ leading: true, trailing: true })
    })

    it('treats escaped wildcards as literals', () => {
        expect(parseLike(escapeLike('a%b_c'))).toEqual({ literal: 'a%b_c', leading: false, trailing: false, inner: false })
    })

    it('wraps patterns without wildcards to mean contains', () => {
        expect(containsPattern('x')).toBe('%x%')
        expect(containsPattern('x%')).toBe('x%')
        expect(containsPattern(escapeLike('5%'))).toBe('%5\\%%')
    })
})

describe('package', () => {
    it('exposes the built entry through the exports map', async () => {
        const manifest = packageJson
        expect(manifest.engines.node).toBe('>=18')
        const entry = new URL(`../${manifest.exports['.'].import}`, import.meta.url).href
        const built = await import(entry)
        expect(typeof built.query).toBe('function')
        expect(typeof built.escapeLike).toBe('function')
        expect(built.query().where('a', 1).build().filters).toHaveLength(1)
    })
})

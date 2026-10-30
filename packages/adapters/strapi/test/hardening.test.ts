import packageJson from '../package.json'
import { MAX_DEPTH, MAX_LIMIT, escapeLike, query } from 'dialectr'
import type { FilterNode, Query } from 'dialectr'
import { describe, expect, it } from 'vitest'
import { toStrapi } from '../src/index.ts'

const raw = (patch: Partial<Query> = {}): Query => ({
    filters: [],
    sorts: [],
    selects: [],
    includes: [],
    aggregates: [],
    ...patch,
})

const condition = (field: string, value: unknown = 1, operator = '='): FilterNode => ({
    kind: 'condition',
    boolean: 'and',
    field,
    operator: operator as never,
    value,
})

describe('toStrapi hardening', () => {
    it('rejects field paths that inject operators', () => {
        for (const field of ['$or', 'a.$or', '$and.a', 'a..b', 'a b', 'a-b', '', '.a']) {
            expect(() => toStrapi(raw({ filters: [condition(field)] }))).toThrow()
        }
        expect(() => toStrapi(query().where('$or', 1).build())).toThrow('Unsupported field name')
    })

    it('rejects injected sort, select and include names', () => {
        expect(() => toStrapi(raw({ sorts: [{ field: 'name:asc,createdBy.password', direction: 'asc' }] }))).toThrow(
            'Unsupported field name',
        )
        expect(() => toStrapi(raw({ sorts: [{ field: 'a', direction: 'asc,createdBy.password:asc' as never }] }))).toThrow(
            'Sort direction',
        )
        expect(() => toStrapi(query().select('$x').build())).toThrow('Unsupported field name')
        expect(() => toStrapi(query().include('*').build())).toThrow('Unsupported field name')
        expect(() => toStrapi(query().include('a.$x').build())).toThrow('Unsupported field name')
        expect(() => toStrapi(query().include('posts', inner => inner.where('$or', 1)).build())).toThrow(
            'Unsupported field name',
        )
    })

    it('rejects non-scalar values and unknown operators in hand-made queries', () => {
        expect(() => toStrapi(raw({ filters: [condition('a', { $gt: 1 })] }))).toThrow('Values must be')
        expect(() => toStrapi(raw({ filters: [condition('a', [1])] }))).toThrow('Values must be')
        expect(() => toStrapi(raw({ filters: [condition('a', Number.NaN)] }))).toThrow('Values must be')
        for (const operator of ['__proto__', 'constructor', null]) {
            expect(() => toStrapi(raw({ filters: [condition('a', 1, operator as never)] }))).toThrow('Unknown operator')
        }
    })

    it('rejects bounds violations', () => {
        let nodes: FilterNode[] = [condition('a')]
        for (let index = 0; index < MAX_DEPTH + 40; index++) nodes = [{ kind: 'group', boolean: 'and', nodes }]
        expect(() => toStrapi(raw({ filters: nodes }))).toThrow('nesting')
        expect(() => toStrapi(raw({ limit: MAX_LIMIT + 1 }))).toThrow('must not exceed')
        expect(() => toStrapi(raw({ sorts: [{ field: 'a', direction: 'up' as never }] }))).toThrow('Sort direction')
    })

    it('rejects empty groups', () => {
        expect(() => toStrapi(raw({ filters: [{ kind: 'group', boolean: 'and', nodes: [] }] }))).toThrow('Empty filter group')
    })

    it('maps empty in and not in lists', () => {
        expect(toStrapi(query().where('id', 'in', []).build()).filters).toEqual({ id: { $in: [] } })
        expect(toStrapi(query().where('id', 'not in', []).build()).filters).toEqual({ id: { $notIn: [] } })
    })

    it('maps null, undefined and Date values', () => {
        expect(toStrapi(query().where('a', null).build()).filters).toEqual({ a: { $eq: null } })
        expect(toStrapi(query().where('a', undefined).build()).filters).toEqual({ a: { $eq: null } })
        expect(toStrapi(query().where('a', '!=', null).build()).filters).toEqual({ a: { $ne: null } })
        expect(toStrapi(query().where('a', new Date('2024-01-02T03:04:05.000Z')).build()).filters).toEqual({
            a: { $eq: '2024-01-02T03:04:05.000Z' },
        })
    })

    it('starts with orWhere without a leading connector', () => {
        expect(toStrapi(query().orWhere('a', 1).orWhere('b', 2).build()).filters).toEqual({
            $or: [{ a: { $eq: 1 } }, { b: { $eq: 2 } }],
        })
    })

    it('maps a lone group and a group followed by or', () => {
        expect(toStrapi(query().whereGroup(group => group.where('a', 1).orWhere('b', 2)).build()).filters).toEqual({
            $or: [{ a: { $eq: 1 } }, { b: { $eq: 2 } }],
        })
        const grouped = query()
            .whereGroup(group => group.where('a', 1).where('b', 2))
            .orWhere('c', 3)
            .build()
        expect(toStrapi(grouped).filters).toEqual({
            $or: [{ $and: [{ a: { $eq: 1 } }, { b: { $eq: 2 } }] }, { c: { $eq: 3 } }],
        })
    })

    it('maps groups nested three levels deep', () => {
        const built = query()
            .where('a', 1)
            .whereGroup(group =>
                group
                    .where('b', 2)
                    .orWhereGroup(inner => inner.where('c', 3).whereGroup(last => last.where('d', 4).orWhere('e', 5))),
            )
            .build()
        expect(toStrapi(built).filters).toEqual({
            $and: [
                { a: { $eq: 1 } },
                {
                    $or: [
                        { b: { $eq: 2 } },
                        { $and: [{ c: { $eq: 3 } }, { $or: [{ d: { $eq: 4 } }, { e: { $eq: 5 } }] }] },
                    ],
                },
            ],
        })
    })

    it('maps like semantics consistently', () => {
        const filter = (value: string, operator: 'like' | 'not like' = 'like') =>
            toStrapi(query().where('t', operator, value).build()).filters
        expect(filter('x')).toEqual({ t: { $containsi: 'x' } })
        expect(filter(escapeLike('100%'))).toEqual({ t: { $containsi: '100%' } })
        expect(filter('%x', 'not like')).toEqual({ t: { $not: { $endsWithi: 'x' } } })
        expect(filter('%' + escapeLike('a_b') + '%')).toEqual({ t: { $containsi: 'a_b' } })
    })

    it('rejects inner like wildcards', () => {
        expect(() => toStrapi(query().where('t', 'like', 'a%b').build())).toThrow('leading or trailing')
        expect(() => toStrapi(query().where('t', 'like', 'a_b').build())).toThrow('leading or trailing')
        expect(() => toStrapi(query().where('t', 'not like', '%a%b%').build())).toThrow('leading or trailing')
    })

    it('maps nested field paths in sort, fields and populate', () => {
        const params = toStrapi(query().sort('a.b').select('c.d').include('e.f').build())
        expect(params).toEqual({ sort: ['a.b:asc'], fields: ['c.d'], populate: ['e.f'] })
    })

    it('resolves the published entry through the exports map', async () => {
        const manifest = packageJson
        expect(manifest.engines.node).toBe('>=18')
        expect(manifest.peerDependencies.dialectr).toBe('workspace:^')
        const entry = new URL(`../${manifest.exports['.'].import}`, import.meta.url).href
        const built = await import(entry)
        expect(built.toStrapi(query().where('a', 1).build()).filters).toEqual({ a: { $eq: 1 } })
    })
})

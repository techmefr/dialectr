import packageJson from '../package.json'
import { MAX_DEPTH, MAX_LIMIT, query } from 'dialectr'
import type { FilterNode, Query } from 'dialectr'
import { describe, expect, it } from 'vitest'
import { toLomkit } from '../src/index.ts'

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

describe('toLomkit hardening', () => {
    it('passes empty in and not in lists through', () => {
        expect(toLomkit(query().where('id', 'in', []).build()).search.filters).toEqual([
            { field: 'id', operator: 'in', value: [] },
        ])
        expect(toLomkit(query().where('id', 'not in', []).build()).search.filters).toEqual([
            { field: 'id', operator: 'not in', value: [] },
        ])
    })

    it('passes null and undefined values through', () => {
        expect(toLomkit(query().where('a', null).build()).search.filters).toEqual([
            { field: 'a', operator: '=', value: null },
        ])
        expect(toLomkit(query().where('a', undefined).build()).search.filters).toEqual([
            { field: 'a', operator: '=', value: undefined },
        ])
    })

    it('maps like without wildcard to contains and keeps explicit wildcards', () => {
        expect(toLomkit(query().where('n', 'like', 'x').build()).search.filters).toEqual([
            { field: 'n', operator: 'like', value: '%x%' },
        ])
        expect(toLomkit(query().where('n', 'not like', 'x%').build()).search.filters).toEqual([
            { field: 'n', operator: 'not like', value: 'x%' },
        ])
    })

    it('rejects invalid selects, values and operators', () => {
        expect(() => toLomkit(raw({ selects: [123 as never] }))).toThrow('Field names')
        expect(() => toLomkit(raw({ selects: [''] }))).toThrow('Field names')
        expect(() => toLomkit(raw({ filters: [condition('a', { x: 1 })] }))).toThrow('Values must be')
        for (const operator of ['__proto__', 'constructor', null]) {
            expect(() => toLomkit(raw({ filters: [condition('a', 1, operator as never)] }))).toThrow('Unknown operator')
        }
    })

    it('rejects bounds violations and empty groups', () => {
        let nodes: FilterNode[] = [condition('a')]
        for (let index = 0; index < MAX_DEPTH + 40; index++) nodes = [{ kind: 'group', boolean: 'and', nodes }]
        expect(() => toLomkit(raw({ filters: nodes }))).toThrow('nesting')
        expect(() => toLomkit(raw({ limit: MAX_LIMIT + 1 }))).toThrow('must not exceed')
        expect(() => toLomkit(raw({ filters: [{ kind: 'group', boolean: 'or', nodes: [] }] }))).toThrow('Empty filter group')
    })

    it('maps an aggregate with a where clause', () => {
        const payload = toLomkit(
            query()
                .aggregate('count', 'posts', { where: builder => builder.where('published', true) })
                .build(),
        )
        expect(payload.search.aggregates).toEqual([
            { relation: 'posts', type: 'count', filters: [{ field: 'published', operator: '=', value: true }] },
        ])
    })

    it('maps nested includes with their own includes and aggregates', () => {
        const payload = toLomkit(
            query()
                .include('posts', posts =>
                    posts
                        .include('comments', comments => comments.where('x', 1))
                        .aggregate('count', 'likes')
                        .limit(3),
                )
                .build(),
        )
        expect(payload.search.includes).toEqual([
            {
                relation: 'posts',
                includes: [{ relation: 'comments', filters: [{ field: 'x', operator: '=', value: 1 }] }],
                aggregates: [{ relation: 'likes', type: 'count' }],
                limit: 3,
            },
        ])
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
        expect(toLomkit(built).search.filters).toEqual([
            { field: 'a', operator: '=', value: 1 },
            {
                nested: [
                    { field: 'b', operator: '=', value: 2 },
                    {
                        type: 'or',
                        nested: [
                            { field: 'c', operator: '=', value: 3 },
                            {
                                nested: [
                                    { field: 'd', operator: '=', value: 4 },
                                    { field: 'e', operator: '=', value: 5, type: 'or' },
                                ],
                            },
                        ],
                    },
                ],
            },
        ])
    })

    it('resolves the published entry through the exports map', async () => {
        const manifest = packageJson
        expect(manifest.engines.node).toBe('>=18')
        expect(manifest.peerDependencies.dialectr).toBe('workspace:^')
        const entry = new URL(`../${manifest.exports['.'].import}`, import.meta.url).href
        const built = await import(entry)
        expect(built.toLomkit(query().where('a', 1).build())).toEqual({
            search: { filters: [{ field: 'a', operator: '=', value: 1 }] },
        })
    })
})

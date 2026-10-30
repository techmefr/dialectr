import packageJson from '../package.json'
import { MAX_DEPTH, MAX_LIMIT, escapeLike, query } from 'dialectr'
import type { FilterNode, Query } from 'dialectr'
import { describe, expect, it } from 'vitest'
import { toPocketbase } from '../src/index.ts'

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

describe('toPocketbase hardening', () => {
    it('rejects injected field names in filters, sorts, selects and relations', () => {
        expect(() => toPocketbase(raw({ filters: [condition('$or')] }))).toThrow('Unsupported field name')
        expect(() => toPocketbase(raw({ filters: [condition('a.$or')] }))).toThrow('Unsupported field name')
        expect(() => toPocketbase(raw({ sorts: [{ field: 'a,b', direction: 'asc' }] }))).toThrow('Unsupported field name')
        expect(() => toPocketbase(raw({ selects: ['a,b'] }))).toThrow('Unsupported field name')
        expect(() => toPocketbase(query().include('a,b').build())).toThrow('Unsupported field name')
        expect(() => toPocketbase(query().include('*').build())).toThrow('Unsupported field name')
    })

    it('rejects non-scalar and non-finite values', () => {
        expect(() => toPocketbase(raw({ filters: [condition('a', { x: 1 })] }))).toThrow('Values must be')
        expect(() => toPocketbase(raw({ filters: [condition('a', [1])] }))).toThrow('Values must be')
        expect(() => toPocketbase(raw({ filters: [condition('a', Number.NaN)] }))).toThrow('Values must be')
        expect(() => toPocketbase(raw({ filters: [condition('a', Number.POSITIVE_INFINITY)] }))).toThrow('Values must be')
        expect(() => toPocketbase(query().where('a', Number.NaN).build())).toThrow('Values must be')
    })

    it('rejects unknown operators', () => {
        for (const operator of ['__proto__', 'constructor', null]) {
            expect(() => toPocketbase(raw({ filters: [condition('a', 1, operator as never)] }))).toThrow('Unknown operator')
        }
    })

    it('rejects bounds violations and empty groups', () => {
        let nodes: FilterNode[] = [condition('a')]
        for (let index = 0; index < MAX_DEPTH + 40; index++) nodes = [{ kind: 'group', boolean: 'and', nodes }]
        expect(() => toPocketbase(raw({ filters: nodes }))).toThrow('nesting')
        expect(() => toPocketbase(raw({ limit: MAX_LIMIT + 1 }))).toThrow('must not exceed')
        expect(() => toPocketbase(raw({ filters: [{ kind: 'group', boolean: 'and', nodes: [] }] }))).toThrow(
            'Empty filter group',
        )
        expect(() => toPocketbase(raw({ sorts: [{ field: 'a', direction: 'up' as never }] }))).toThrow('Sort direction')
    })

    it('refuses includes that carry constraints', () => {
        expect(() => toPocketbase(query().include('posts', inner => inner.where('t', 'x')).build())).toThrow(
            'expanded relations',
        )
        expect(() => toPocketbase(query().include('posts', inner => inner.limit(2)).build())).toThrow('expanded relations')
        expect(toPocketbase(query().include('posts').build()).expand).toBe('posts')
    })

    it('maps empty in and not in lists', () => {
        expect(toPocketbase(query().where('id', 'not in', []).build()).filter).toBe('true')
        expect(toPocketbase(query().where('id', 'in', []).build()).filter).toBe('false')
    })

    it('maps null, undefined and Date values', () => {
        expect(toPocketbase(query().where('a', null).build()).filter).toBe('a=null')
        expect(toPocketbase(query().where('a', undefined).build()).filter).toBe('a=null')
        expect(toPocketbase(query().where('d', new Date('2024-01-02T03:04:05.000Z')).build()).filter).toBe(
            "d='2024-01-02 03:04:05.000Z'",
        )
    })

    it('maps like and not like consistently', () => {
        const filter = (value: string, operator: 'like' | 'not like' = 'like') =>
            toPocketbase(query().where('n', operator, value).build()).filter
        expect(filter('A%', 'not like')).toBe("n!~'A%'")
        expect(filter('x')).toBe("n~'%x%'")
        expect(filter('x', 'not like')).toBe("n!~'%x%'")
        expect(filter(escapeLike('100%'))).toBe(String.raw`n~'%100\\%%'`)
    })

    it('starts with orWhere without a leading connector', () => {
        expect(toPocketbase(query().orWhere('a', 1).orWhere('b', 2).build()).filter).toBe('(a=1) || (b=2)')
    })

    it('maps a lone group and a group followed by or', () => {
        expect(toPocketbase(query().whereGroup(group => group.where('a', 1).orWhere('b', 2)).build()).filter).toBe(
            '((a=1) || (b=2))',
        )
        const grouped = query()
            .whereGroup(group => group.where('a', 1).where('b', 2))
            .orWhere('c', 3)
            .build()
        expect(toPocketbase(grouped).filter).toBe('((a=1 && b=2)) || (c=3)')
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
        expect(toPocketbase(built).filter).toBe('a=1 && ((b=2) || ((c=3 && ((d=4) || (e=5)))))')
    })

    it('resolves the published entry through the exports map', async () => {
        const manifest = packageJson
        expect(manifest.engines.node).toBe('>=18')
        expect(manifest.peerDependencies.dialectr).toBe('workspace:^')
        const entry = new URL(`../${manifest.exports['.'].import}`, import.meta.url).href
        const built = await import(entry)
        expect(built.toPocketbase(query().where('a', 1).build()).filter).toBe('a=1')
    })
})

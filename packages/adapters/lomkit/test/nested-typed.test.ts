import { query } from 'dialectr'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { toLomkit } from '../src/index.ts'
import type { LomkitExtension, LomkitGate, LomkitScope } from '../src/index.ts'

describe('nested includes', () => {
    it('compiles a dotted path into nested includes', () => {
        const payload = toLomkit(query().include('posts.comments').build())
        expect(payload.search.includes).toStrictEqual([{ relation: 'posts', includes: [{ relation: 'comments' }] }])
    })

    it('compiles a three level path', () => {
        const payload = toLomkit(query().include('a.b.c').build())
        expect(payload.search.includes).toStrictEqual([
            { relation: 'a', includes: [{ relation: 'b', includes: [{ relation: 'c' }] }] },
        ])
    })

    it('applies the callback to the deepest relation', () => {
        const payload = toLomkit(query().include('posts.comments', inner => inner.where('approved', true).limit(3)).build())
        expect(payload.search.includes).toStrictEqual([
            {
                relation: 'posts',
                includes: [
                    { relation: 'comments', filters: [{ field: 'approved', operator: '=', value: true }], limit: 3 },
                ],
            },
        ])
    })

    it('merges siblings that share a prefix', () => {
        const payload = toLomkit(
            query()
                .include('posts', inner => inner.where('published', true))
                .include('posts.comments')
                .include('posts.tags')
                .include('author')
                .build(),
        )
        expect(payload.search.includes).toStrictEqual([
            {
                relation: 'posts',
                filters: [{ field: 'published', operator: '=', value: true }],
                includes: [{ relation: 'comments' }, { relation: 'tags' }],
            },
            { relation: 'author' },
        ])
    })

    it('keeps the nested includes of a callback', () => {
        const payload = toLomkit(query().include('posts', inner => inner.include('comments', deep => deep.sort('id', 'desc'))).build())
        expect(payload.search.includes).toStrictEqual([
            { relation: 'posts', includes: [{ relation: 'comments', sorts: [{ field: 'id', direction: 'desc' }] }] },
        ])
    })

    it('merges a callback include with dotted siblings declared first', () => {
        const payload = toLomkit(
            query()
                .include('posts.comments')
                .include('posts', inner => inner.include('tags'))
                .build(),
        )
        expect(payload.search.includes).toStrictEqual([
            { relation: 'posts', includes: [{ relation: 'comments' }, { relation: 'tags' }] },
        ])
    })
})

describe('keyword fields', () => {
    it('passes the keyword suffix through for filters and sorts', () => {
        const payload = toLomkit(
            query().where('title.keyword', 'Hello').where('tags.keyword', 'in', ['a', 'b']).sort('title.keyword', 'desc').build(),
        )
        expect(payload.search.filters).toEqual([
            { field: 'title.keyword', operator: '=', value: 'Hello' },
            { field: 'tags.keyword', operator: 'in', value: ['a', 'b'] },
        ])
        expect(payload.search.sorts).toEqual([{ field: 'title.keyword', direction: 'desc' }])
    })
})

describe('typed lomkit extension', () => {
    it('accepts gates, scopes with parameters and instructions', () => {
        const extension: LomkitExtension = {
            gates: ['create', 'update', 'delete', 'view', 'restore', 'forceDelete'],
            scopes: [{ name: 'byStatus', parameters: ['open'] }],
            instructions: [{ name: 'mark', fields: [{ name: 'status', value: 'done' }] }],
        }
        const payload = toLomkit(query().extend('lomkit', extension).build())
        expect(payload.search).toEqual(extension)
    })

    it('types the extension', () => {
        expectTypeOf<LomkitGate>().toEqualTypeOf<'create' | 'view' | 'update' | 'delete' | 'restore' | 'forceDelete'>()
        expectTypeOf<LomkitScope>().toEqualTypeOf<{ name: string; parameters?: unknown[] }>()
        query().extend('lomkit', { gates: ['view'], scopes: [{ name: 'a', parameters: [1] }] })
        query().extend('strapi', { anything: 1 })
        expect(() => {
            // @ts-expect-error
            query().extend('lomkit', { gates: ['nope'] })
            // @ts-expect-error
            query().extend('lomkit', { scopes: ['a'] })
            // @ts-expect-error
            query().extend('lomkit', { filters: [] })
        }).not.toThrow()
    })
})

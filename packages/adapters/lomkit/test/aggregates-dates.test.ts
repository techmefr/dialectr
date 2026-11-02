import { query } from 'dialectr'
import { describe, expect, it } from 'vitest'
import { toLomkit } from '../src/index.ts'

const aggregates = (build: ReturnType<typeof query>) => toLomkit(build.build()).search.aggregates

describe('aggregate aliases', () => {
    it('leaves a lone aggregate without alias', () => {
        expect(aggregates(query().aggregate('count', 'posts'))).toEqual([{ relation: 'posts', type: 'count' }])
    })

    it('aliases the later aggregates sharing type, relation and field', () => {
        expect(
            aggregates(
                query()
                    .aggregate('count', 'posts')
                    .aggregate('count', 'posts', { where: filter => filter.where('published', true) })
                    .aggregate('count', 'posts', { where: filter => filter.where('published', false) }),
            ),
        ).toEqual([
            { relation: 'posts', type: 'count' },
            { relation: 'posts', type: 'count', alias: 'posts_count_2', filters: [{ field: 'published', operator: '=', value: true }] },
            { relation: 'posts', type: 'count', alias: 'posts_count_3', filters: [{ field: 'published', operator: '=', value: false }] },
        ])
    })

    it('includes the field in the generated key', () => {
        expect(
            aggregates(query().aggregate('sum', 'posts', { field: 'views' }).aggregate('sum', 'posts', { field: 'views' })),
        ).toEqual([
            { relation: 'posts', type: 'sum', field: 'views' },
            { relation: 'posts', type: 'sum', field: 'views', alias: 'posts_sum_views_2' },
        ])
        expect(
            aggregates(query().aggregate('sum', 'posts', { field: 'views' }).aggregate('sum', 'posts', { field: 'likes' })),
        ).toEqual([
            { relation: 'posts', type: 'sum', field: 'views' },
            { relation: 'posts', type: 'sum', field: 'likes' },
        ])
    })

    it('emits an explicit alias and keeps generated ones unique against it', () => {
        expect(
            aggregates(
                query()
                    .aggregate('count', 'posts', { alias: 'published_posts' })
                    .aggregate('count', 'posts')
                    .aggregate('count', 'posts', { alias: 'posts_count_2' })
                    .aggregate('count', 'posts'),
            ),
        ).toEqual([
            { relation: 'posts', type: 'count', alias: 'published_posts' },
            { relation: 'posts', type: 'count' },
            { relation: 'posts', type: 'count', alias: 'posts_count_2' },
            { relation: 'posts', type: 'count', alias: 'posts_count_3' },
        ])
    })

    it('validates the alias', () => {
        expect(() => query().aggregate('count', 'posts', { alias: '' })).toThrow()
    })
})

describe('dates', () => {
    it('emits UTC Y-m-d H:i:s without milliseconds, lists included', () => {
        const date = new Date('2026-01-02T03:04:05.678Z')
        expect(toLomkit(query().where('d', '>', date).where('e', 'in', [date, null]).build()).search.filters).toEqual([
            { field: 'd', operator: '>', value: '2026-01-02 03:04:05' },
            { field: 'e', operator: 'in', value: ['2026-01-02 03:04:05', null] },
        ])
    })

    it('leaves strings untouched', () => {
        expect(toLomkit(query().where('d', '2026-01-02T03:04:05.000Z').build()).search.filters).toEqual([
            { field: 'd', operator: '=', value: '2026-01-02T03:04:05.000Z' },
        ])
    })
})

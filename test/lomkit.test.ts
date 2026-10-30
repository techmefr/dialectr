import { describe, expect, it } from 'vitest'
import { query } from '../src/index.ts'
import { toLomkit } from '../src/lomkit.ts'

interface Report {
  id: number
  title: string
  created_at: string
}

describe('toLomkit', () => {
  it('compiles an empty query to an empty search', () => {
    expect(query().to(toLomkit)).toEqual({})
  })

  it('uses = when where has no operator', () => {
    expect(query<Report>().where('title', 'Q2').to(toLomkit)).toEqual({
      filters: [{ field: 'title', operator: '=', value: 'Q2' }],
    })
  })

  it('keeps an explicit operator and marks orWhere as or', () => {
    const search = query<Report>()
      .where('created_at', '>=', '2026-01-01')
      .orWhere('title', 'like', '%Q2%')
      .to(toLomkit)
    expect(search.filters).toEqual([
      { field: 'created_at', operator: '>=', value: '2026-01-01' },
      { field: 'title', operator: 'like', value: '%Q2%', type: 'or' },
    ])
  })

  it('compiles groups to nested filters', () => {
    const search = query()
      .where('status.slug', 'published')
      .whereGroup(group => group.where('creator.id', 1).orWhere('is_shared', true))
      .to(toLomkit)
    expect(search.filters).toEqual([
      { field: 'status.slug', operator: '=', value: 'published' },
      {
        nested: [
          { field: 'creator.id', operator: '=', value: 1 },
          { field: 'is_shared', operator: '=', value: true, type: 'or' },
        ],
      },
    ])
  })

  it('compiles includes with their own constraints', () => {
    const search = query()
      .include('subjects', sub => sub.select('id').limit(5))
      .include('creator')
      .to(toLomkit)
    expect(search.includes).toEqual([
      { relation: 'subjects', selects: [{ field: 'id' }], limit: 5 },
      { relation: 'creator' },
    ])
  })

  it('compiles sort, select, text search and pagination', () => {
    const search = query<Report>()
      .orderBy('created_at', 'desc')
      .select('id', 'title')
      .search('quarterly')
      .limit(10)
      .page(2)
      .to(toLomkit)
    expect(search).toEqual({
      sorts: [{ field: 'created_at', direction: 'desc' }],
      selects: [{ field: 'id' }, { field: 'title' }],
      text: { value: 'quarterly' },
      limit: 10,
      page: 2,
    })
  })

  it('merges lomkit-only extensions', () => {
    const search = query().extend('lomkit', { scopes: [{ name: 'mine' }] }).to(toLomkit)
    expect(search).toEqual({ scopes: [{ name: 'mine' }] })
  })

  it('does not mutate the original builder', () => {
    const base = query<Report>().where('title', 'a')
    base.where('title', 'b')
    expect(base.build().filters).toHaveLength(1)
  })
})

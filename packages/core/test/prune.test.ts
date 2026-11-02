import { describe, expect, it } from 'vitest'
import { pruneAlwaysTrue, query } from '../src/index.ts'

const prune = (build: ReturnType<typeof query>) => pruneAlwaysTrue(build.build().filters)

describe('pruneAlwaysTrue', () => {
    it('returns the nodes untouched when nothing is always true', () => {
        const nodes = query().where('a', 1).orWhere('b', 2).build().filters
        expect(pruneAlwaysTrue(nodes)).toEqual(nodes)
    })

    it('drops not in [] from an and cluster', () => {
        expect(prune(query().where('a', 1).where('b', 'not in', []))).toMatchObject([{ field: 'a' }])
    })

    it('returns null when an or cluster is always true', () => {
        expect(prune(query().where('a', 1).orWhere('b', 'not in', []))).toBeNull()
        expect(prune(query().where('b', 'not in', []))).toBeNull()
    })

    it('returns an empty list for no nodes', () => {
        expect(pruneAlwaysTrue([])).toEqual([])
    })

    it('rewrites connectors so the first node of each later cluster is or', () => {
        const kept = prune(query().where('x', 'not in', []).where('a', 1).orWhere('b', 2).where('c', 3))
        expect(kept?.map(node => node.boolean)).toEqual(['and', 'or', 'and'])
    })

    it('keeps aggregate alias through build', () => {
        expect(query().aggregate('count', 'posts', { alias: 'n' }).build().aggregates[0].alias).toBe('n')
    })
})

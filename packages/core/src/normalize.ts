import type { FilterNode, Query } from './types.ts'

export function getExtension(query: Query, target: string): unknown {
    const extensions = query.extensions
    if (extensions === undefined || !Object.hasOwn(extensions, target)) return undefined
    return extensions[target]
}

export function groupByOr(nodes: FilterNode[]): FilterNode[][] {
    const clusters: FilterNode[][] = []
    for (const node of nodes) {
        if (clusters.length === 0 || node.boolean === 'or') clusters.push([node])
        else clusters[clusters.length - 1].push(node)
    }
    return clusters
}

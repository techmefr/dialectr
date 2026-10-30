import type { FilterNode } from './types.ts'

export function groupByOr(nodes: FilterNode[]): FilterNode[][] {
    const clusters: FilterNode[][] = []
    for (const node of nodes) {
        if (clusters.length === 0 || node.boolean === 'or') clusters.push([node])
        else clusters[clusters.length - 1].push(node)
    }
    return clusters
}

import type { FilterNode } from './types.ts'

// Splits a filter list into OR-separated clusters of AND-ed nodes, following
// SQL precedence (AND binds tighter than OR). The first node's boolean is ignored.
export function groupByOr(nodes: FilterNode[]): FilterNode[][] {
    const clusters: FilterNode[][] = []
    for (const node of nodes) {
        if (clusters.length === 0 || node.boolean === 'or') clusters.push([node])
        else clusters[clusters.length - 1].push(node)
    }
    return clusters
}

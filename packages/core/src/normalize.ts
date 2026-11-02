import type { Condition, FilterNode, Query } from './types.ts'

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

function isAlwaysTrue(node: Condition): boolean {
    return node.operator === 'not in' && Array.isArray(node.value) && node.value.length === 0
}

export function pruneAlwaysTrue(nodes: FilterNode[]): FilterNode[] | null {
    const clusters: FilterNode[][] = []
    for (const cluster of groupByOr(nodes)) {
        const kept: FilterNode[] = []
        for (const node of cluster) {
            if (node.kind === 'condition') {
                if (!isAlwaysTrue(node)) kept.push(node)
                continue
            }
            const inner = pruneAlwaysTrue(node.nodes)
            if (inner !== null) kept.push({ ...node, nodes: inner })
        }
        if (kept.length === 0) return null
        clusters.push(kept)
    }
    return clusters.flatMap((cluster, clusterIndex) =>
        cluster.map((node, index) => ({
            ...node,
            boolean: index === 0 && clusterIndex > 0 ? ('or' as const) : ('and' as const),
        })),
    )
}

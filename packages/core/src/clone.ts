import type { FilterNode, Query } from './types.ts'

export function cloneValue<V>(value: V): V {
    if (Array.isArray(value)) return value.map(cloneValue) as V
    if (value instanceof Date) return new Date(value.getTime()) as V
    return value
}

export function cloneExtensionValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(cloneExtensionValue)
    if (value instanceof Date) return new Date(value.getTime())
    if (value !== null && typeof value === 'object') {
        const copy: Record<string, unknown> = {}
        for (const key of Object.keys(value)) copy[key] = cloneExtensionValue((value as Record<string, unknown>)[key])
        return copy
    }
    return value
}

function cloneExtensions(extensions: Record<string, unknown>): Record<string, unknown> {
    const copy: Record<string, unknown> = {}
    for (const key of Object.keys(extensions)) copy[key] = cloneExtensionValue(extensions[key])
    return copy
}

function cloneNodes(nodes: FilterNode[]): FilterNode[] {
    return nodes.map(node =>
        node.kind === 'group'
            ? { kind: 'group', boolean: node.boolean, nodes: cloneNodes(node.nodes) }
            : {
                  kind: 'condition',
                  boolean: node.boolean,
                  field: node.field,
                  operator: node.operator,
                  value: cloneValue(node.value),
              },
    )
}

export function cloneQuery(query: Query): Query {
    return {
        filters: cloneNodes(query.filters),
        sorts: query.sorts.map(sort => ({ field: sort.field, direction: sort.direction })),
        selects: [...query.selects],
        includes: query.includes.map(include => ({ relation: include.relation, query: cloneQuery(include.query) })),
        aggregates: query.aggregates.map(aggregate => ({
            type: aggregate.type,
            relation: aggregate.relation,
            ...(aggregate.field === undefined ? {} : { field: aggregate.field }),
            filters: cloneNodes(aggregate.filters),
        })),
        ...(query.search === undefined ? {} : { search: query.search }),
        ...(query.extensions === undefined || Object.keys(query.extensions).length === 0
            ? {}
            : { extensions: cloneExtensions(query.extensions) }),
        ...(query.limit === undefined ? {} : { limit: query.limit }),
        ...(query.page === undefined ? {} : { page: query.page }),
    }
}

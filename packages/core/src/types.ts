export type Operator = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'like' | 'not like' | 'in' | 'not in'

export type Connector = 'and' | 'or'

export type SortDirection = 'asc' | 'desc'

export type AggregateType = 'count' | 'min' | 'max' | 'avg' | 'sum' | 'exists'

export interface Condition {
    kind: 'condition'
    boolean: Connector
    field: string
    operator: Operator
    value: unknown
}

export interface Group {
    kind: 'group'
    boolean: Connector
    nodes: FilterNode[]
}

export type FilterNode = Condition | Group

export interface Sort {
    field: string
    direction: SortDirection
}

export interface Aggregate {
    type: AggregateType
    relation: string
    field?: string
    filters: FilterNode[]
}

export interface Include {
    relation: string
    query: Query
}

export interface Query {
    filters: FilterNode[]
    sorts: Sort[]
    selects: string[]
    includes: Include[]
    aggregates: Aggregate[]
    search?: string
    extensions?: Record<string, unknown>
    limit?: number
    page?: number
}

export type Compiler<TOutput> = (query: Query) => TOutput

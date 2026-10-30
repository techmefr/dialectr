import type {
    Aggregate,
    AggregateType,
    Connector,
    FilterNode,
    Include,
    Operator,
    Query,
    SortDirection,
} from './types.ts'

export type Field<T> = Extract<keyof T, string>

const OPERATORS: readonly Operator[] = ['=', '!=', '>', '>=', '<', '<=', 'like', 'not like', 'in', 'not in']

const emptyQuery = (): Query => ({
    filters: [],
    sorts: [],
    selects: [],
    includes: [],
    aggregates: [],
})

function assertOperator(operator: string): asserts operator is Operator {
    if (!OPERATORS.includes(operator as Operator)) throw new Error(`Unknown operator: "${operator}"`)
}

function assertList(operator: Operator, value: unknown): void {
    if ((operator === 'in' || operator === 'not in') && !Array.isArray(value)) {
        throw new Error(`Operator "${operator}" requires an array value`)
    }
}

export class QueryBuilder<T extends object = Record<string, unknown>> {
    readonly #query: Query

    constructor(query: Query = emptyQuery()) {
        this.#query = query
    }

    where(field: Field<T>, value: unknown): QueryBuilder<T>
    where(field: Field<T>, operator: Operator, value: unknown): QueryBuilder<T>
    where(field: Field<T>, operatorOrValue: unknown, maybeValue?: unknown): QueryBuilder<T> {
        return this.#condition('and', field, operatorOrValue, maybeValue, arguments.length)
    }

    orWhere(field: Field<T>, value: unknown): QueryBuilder<T>
    orWhere(field: Field<T>, operator: Operator, value: unknown): QueryBuilder<T>
    orWhere(field: Field<T>, operatorOrValue: unknown, maybeValue?: unknown): QueryBuilder<T> {
        return this.#condition('or', field, operatorOrValue, maybeValue, arguments.length)
    }

    whereGroup(callback: (builder: QueryBuilder<T>) => QueryBuilder<T>): QueryBuilder<T> {
        return this.#group('and', callback)
    }

    orWhereGroup(callback: (builder: QueryBuilder<T>) => QueryBuilder<T>): QueryBuilder<T> {
        return this.#group('or', callback)
    }

    sort(field: Field<T>, direction: SortDirection = 'asc'): QueryBuilder<T> {
        return this.#next({ sorts: [...this.#query.sorts, { field, direction }] })
    }

    select(...fields: Array<Field<T>>): QueryBuilder<T> {
        return this.#next({ selects: [...this.#query.selects, ...fields] })
    }

    include(
        relation: string,
        callback?: (builder: QueryBuilder) => QueryBuilder,
    ): QueryBuilder<T> {
        const query = callback ? callback(new QueryBuilder()).build() : emptyQuery()
        const include: Include = { relation, query }
        return this.#next({ includes: [...this.#query.includes, include] })
    }

    aggregate(
        type: AggregateType,
        relation: string,
        options: { field?: string; where?: (builder: QueryBuilder) => QueryBuilder } = {},
    ): QueryBuilder<T> {
        const filters = options.where ? options.where(new QueryBuilder()).build().filters : []
        const aggregate: Aggregate = { type, relation, field: options.field, filters }
        return this.#next({ aggregates: [...this.#query.aggregates, aggregate] })
    }

    limit(limit: number): QueryBuilder<T> {
        if (!Number.isInteger(limit) || limit < 1) throw new Error('limit must be a positive integer')
        return this.#next({ limit })
    }

    page(page: number): QueryBuilder<T> {
        if (!Number.isInteger(page) || page < 1) throw new Error('page must be a positive integer')
        return this.#next({ page })
    }

    build(): Query {
        return structuredClone(this.#query)
    }

    #next(patch: Partial<Query>): QueryBuilder<T> {
        return new QueryBuilder<T>({ ...this.#query, ...patch })
    }

    #condition(
        boolean: Connector,
        field: string,
        operatorOrValue: unknown,
        maybeValue: unknown,
        argumentCount: number,
    ): QueryBuilder<T> {
        const hasOperator = argumentCount >= 3
        const operator: Operator = hasOperator ? (operatorOrValue as Operator) : '='
        const value = hasOperator ? maybeValue : operatorOrValue
        assertOperator(operator)
        assertList(operator, value)
        const node: FilterNode = { kind: 'condition', boolean, field, operator, value }
        return this.#next({ filters: [...this.#query.filters, node] })
    }

    #group(boolean: Connector, callback: (builder: QueryBuilder<T>) => QueryBuilder<T>): QueryBuilder<T> {
        const nodes = callback(new QueryBuilder<T>()).build().filters
        if (nodes.length === 0) return this
        const node: FilterNode = { kind: 'group', boolean, nodes }
        return this.#next({ filters: [...this.#query.filters, node] })
    }
}

export function query<T extends object = Record<string, unknown>>(): QueryBuilder<T> {
    return new QueryBuilder<T>()
}

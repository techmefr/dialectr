import { cloneQuery, cloneValue } from './clone.ts'
import {
    assertDirection,
    assertField,
    assertLimit,
    assertOperator,
    assertPage,
    assertQuery,
    assertValue,
} from './validate.ts'
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

const emptyQuery = (): Query => ({
    filters: [],
    sorts: [],
    selects: [],
    includes: [],
    aggregates: [],
})

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
        assertField(field)
        assertDirection(direction)
        return this.#next({ sorts: [...this.#query.sorts, { field, direction }] })
    }

    select(...fields: Array<Field<T>>): QueryBuilder<T> {
        fields.forEach(assertField)
        return this.#next({ selects: [...this.#query.selects, ...fields] })
    }

    include(
        relation: string,
        callback?: (builder: QueryBuilder) => QueryBuilder,
    ): QueryBuilder<T> {
        assertField(relation)
        const query = callback ? callback(new QueryBuilder()).build() : emptyQuery()
        const include: Include = { relation, query }
        return this.#next({ includes: [...this.#query.includes, include] })
    }

    aggregate(
        type: AggregateType,
        relation: string,
        options: { field?: string; where?: (builder: QueryBuilder) => QueryBuilder } = {},
    ): QueryBuilder<T> {
        assertField(relation)
        if (options.field !== undefined) assertField(options.field)
        const filters = options.where ? options.where(new QueryBuilder()).build().filters : []
        const aggregate: Aggregate = {
            type,
            relation,
            ...(options.field === undefined ? {} : { field: options.field }),
            filters,
        }
        return this.#next({ aggregates: [...this.#query.aggregates, aggregate] })
    }

    limit(limit: number): QueryBuilder<T> {
        assertLimit(limit)
        return this.#next({ limit })
    }

    page(page: number): QueryBuilder<T> {
        assertPage(page)
        return this.#next({ page })
    }

    build(): Query {
        assertQuery(this.#query)
        return cloneQuery(this.#query)
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
        const operator = hasOperator ? operatorOrValue : '='
        const value = hasOperator ? maybeValue : operatorOrValue
        assertField(field)
        assertOperator(operator)
        assertValue(operator, value)
        const node: FilterNode = {
            kind: 'condition',
            boolean,
            field,
            operator: operator as Operator,
            value: cloneValue(value),
        }
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

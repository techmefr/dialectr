import { cloneExtensionValue, cloneValue } from './clone.ts'
import {
    assertDirection,
    assertExtensionKey,
    assertExtensionValue,
    assertField,
    assertLimit,
    assertOperator,
    assertPage,
    assertSearch,
    assertValue,
    prepareQuery,
} from './validate.ts'
import type {
    Aggregate,
    AggregateType,
    Compiler,
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

const trusted = new WeakSet<Query>()

export class QueryBuilder<T extends object = Record<string, unknown>> {
    readonly #query: Query

    constructor(query: Query = emptyQuery()) {
        this.#query = trusted.has(query) ? query : prepareQuery(query)
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

    search(text: string): QueryBuilder<T> {
        assertSearch(text)
        return this.#next({ search: text })
    }

    extend(target: string, value: unknown): QueryBuilder<T> {
        assertExtensionKey(target)
        assertExtensionValue(value)
        const extensions = { ...(this.#query.extensions ?? {}), [target]: cloneExtensionValue(value) }
        return this.#next({ extensions })
    }

    to<TOutput>(compiler: Compiler<TOutput>): TOutput {
        return compiler(this.build())
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
        return prepareQuery(this.#query)
    }

    #next(patch: Partial<Query>): QueryBuilder<T> {
        const next: Query = { ...this.#query, ...patch }
        trusted.add(next)
        return new QueryBuilder<T>(next)
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

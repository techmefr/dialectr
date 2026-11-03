import { assertDirection, assertField, assertLimit, assertPage, assertSearch } from './assertions.ts'
import type { ComparisonOperator, ExtensionMap, Field, FieldValue, Present } from './builder-types.ts'
import { runCallback } from './callback.ts'
import { cloneExtensionValue } from './clone.ts'
import { conditionNode, isBlankCondition } from './condition.ts'
import { assertExtensionKey, assertExtensionValue } from './extensions.ts'
import { prepareQuery } from './validate.ts'
import type {
    Aggregate,
    AggregateType,
    Compiler,
    Connector,
    FilterNode,
    Include,
    Query,
    SortDirection,
} from './types.ts'

export type { ComparisonOperator, ExtensionMap, Field, FieldValue, Present } from './builder-types.ts'

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

    where<K extends Field<T>>(field: K, value: FieldValue<T, K>): QueryBuilder<T>
    where<K extends Field<T>>(field: K, operator: ComparisonOperator, value: FieldValue<T, K>): QueryBuilder<T>
    where<K extends Field<T>>(field: K, operator: 'in' | 'not in', value: Array<FieldValue<T, K>>): QueryBuilder<T>
    where(field: Field<T>, operator: 'like' | 'not like', value: string): QueryBuilder<T>
    where(field: Field<T>, operatorOrValue: unknown, maybeValue?: unknown): QueryBuilder<T> {
        return this.#condition('and', field, operatorOrValue, maybeValue, arguments.length)
    }

    orWhere<K extends Field<T>>(field: K, value: FieldValue<T, K>): QueryBuilder<T>
    orWhere<K extends Field<T>>(field: K, operator: ComparisonOperator, value: FieldValue<T, K>): QueryBuilder<T>
    orWhere<K extends Field<T>>(field: K, operator: 'in' | 'not in', value: Array<FieldValue<T, K>>): QueryBuilder<T>
    orWhere(field: Field<T>, operator: 'like' | 'not like', value: string): QueryBuilder<T>
    orWhere(field: Field<T>, operatorOrValue: unknown, maybeValue?: unknown): QueryBuilder<T> {
        return this.#condition('or', field, operatorOrValue, maybeValue, arguments.length)
    }

    whereIf<K extends Field<T>>(field: K, value: FieldValue<T, K> | null | undefined): QueryBuilder<T>
    whereIf<K extends Field<T>>(field: K, operator: ComparisonOperator, value: FieldValue<T, K> | null | undefined): QueryBuilder<T>
    whereIf<K extends Field<T>>(
        field: K,
        operator: 'in' | 'not in',
        value: Array<FieldValue<T, K>> | null | undefined,
    ): QueryBuilder<T>
    whereIf(field: Field<T>, operator: 'like' | 'not like', value: string | null | undefined): QueryBuilder<T>
    whereIf(field: Field<T>, operatorOrValue: unknown, maybeValue?: unknown): QueryBuilder<T> {
        if (isBlankCondition(operatorOrValue, maybeValue, arguments.length)) return this
        return this.#condition('and', field, operatorOrValue, maybeValue, arguments.length)
    }

    orWhereIf<K extends Field<T>>(field: K, value: FieldValue<T, K> | null | undefined): QueryBuilder<T>
    orWhereIf<K extends Field<T>>(field: K, operator: ComparisonOperator, value: FieldValue<T, K> | null | undefined): QueryBuilder<T>
    orWhereIf<K extends Field<T>>(
        field: K,
        operator: 'in' | 'not in',
        value: Array<FieldValue<T, K>> | null | undefined,
    ): QueryBuilder<T>
    orWhereIf(field: Field<T>, operator: 'like' | 'not like', value: string | null | undefined): QueryBuilder<T>
    orWhereIf(field: Field<T>, operatorOrValue: unknown, maybeValue?: unknown): QueryBuilder<T> {
        if (isBlankCondition(operatorOrValue, maybeValue, arguments.length)) return this
        return this.#condition('or', field, operatorOrValue, maybeValue, arguments.length)
    }

    when<V>(condition: V, callback: (builder: QueryBuilder<T>, value: Present<V>) => QueryBuilder<T>): QueryBuilder<T> {
        if (!condition) return this
        return runCallback<QueryBuilder<T>>('when', builder => callback(builder, condition as Present<V>), this)
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
        const query = callback ? runCallback('include', callback, new QueryBuilder()).build() : emptyQuery()
        const include: Include = { relation, query }
        return this.#next({ includes: [...this.#query.includes, include] })
    }

    aggregate(
        type: AggregateType,
        relation: string,
        options: { field?: string; alias?: string; where?: (builder: QueryBuilder) => QueryBuilder } = {},
    ): QueryBuilder<T> {
        assertField(relation)
        if (options.field !== undefined) assertField(options.field)
        if (options.alias !== undefined) assertField(options.alias)
        const filters = options.where ? runCallback('aggregate where', options.where, new QueryBuilder()).build().filters : []
        const aggregate: Aggregate = {
            type,
            relation,
            ...(options.field === undefined ? {} : { field: options.field }),
            ...(options.alias === undefined ? {} : { alias: options.alias }),
            filters,
        }
        return this.#next({ aggregates: [...this.#query.aggregates, aggregate] })
    }

    search(text: string): QueryBuilder<T> {
        assertSearch(text)
        return this.#next({ search: text })
    }

    extend<K extends string>(target: K, value: K extends keyof ExtensionMap ? ExtensionMap[K] : unknown): QueryBuilder<T> {
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
        const node = conditionNode(boolean, field, operatorOrValue, maybeValue, argumentCount)
        return this.#next({ filters: [...this.#query.filters, node] })
    }

    #group(boolean: Connector, callback: (builder: QueryBuilder<T>) => QueryBuilder<T>): QueryBuilder<T> {
        const nodes = runCallback(boolean === 'and' ? 'whereGroup' : 'orWhereGroup', callback, new QueryBuilder<T>()).build().filters
        if (nodes.length === 0) return this.#next({})
        const node: FilterNode = { kind: 'group', boolean, nodes }
        return this.#next({ filters: [...this.#query.filters, node] })
    }
}

export function query<T extends object = Record<string, unknown>>(): QueryBuilder<T> {
    return new QueryBuilder<T>()
}

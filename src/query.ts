import type {
  Compiler,
  Connector,
  Direction,
  FieldOf,
  FilterNode,
  Operator,
  QueryAst,
} from './types.ts'

export interface Query<T = Record<string, unknown>> {
  where: WhereMethod<T>
  orWhere: WhereMethod<T>
  whereGroup: (callback: (query: Query<T>) => Query<T>) => Query<T>
  orWhereGroup: (callback: (query: Query<T>) => Query<T>) => Query<T>
  include: (relation: string, callback?: (query: Query) => Query) => Query<T>
  orderBy: (field: FieldOf<T>, direction?: Direction) => Query<T>
  select: (...fields: FieldOf<T>[]) => Query<T>
  search: (text: string) => Query<T>
  limit: (count: number) => Query<T>
  page: (number: number) => Query<T>
  extend: (target: string, value: unknown) => Query<T>
  build: () => QueryAst
  to: <TOutput>(compiler: Compiler<TOutput>) => TOutput
}

interface WhereMethod<T> {
  (field: FieldOf<T>, value: unknown): Query<T>
  (field: FieldOf<T>, operator: Operator, value: unknown): Query<T>
}

const OPERATORS: ReadonlySet<string> = new Set([
  '=',
  '!=',
  '>',
  '>=',
  '<',
  '<=',
  'in',
  'not in',
  'like',
  'not like',
])

const emptyAst = (): QueryAst => ({
  filters: [],
  sorts: [],
  selects: [],
  includes: [],
  extensions: {},
})

const isOperator = (value: unknown): value is Operator =>
  typeof value === 'string' && OPERATORS.has(value)

const createWhere = <T>(
  connector: Connector,
  push: (node: FilterNode) => Query<T>,
): WhereMethod<T> =>
  ((field: string, operatorOrValue: unknown, maybeValue?: unknown) => {
    const hasOperator = maybeValue !== undefined && isOperator(operatorOrValue)
    return push({
      kind: 'condition',
      field,
      operator: hasOperator ? operatorOrValue : '=',
      value: hasOperator ? maybeValue : operatorOrValue,
      connector,
    })
  }) as WhereMethod<T>

const make = <T>(ast: QueryAst): Query<T> => {
  const next = (patch: Partial<QueryAst>): Query<T> => make<T>({ ...ast, ...patch })
  const pushFilter = (node: FilterNode): Query<T> => next({ filters: [...ast.filters, node] })
  const group = (connector: Connector, callback: (query: Query<T>) => Query<T>): Query<T> =>
    pushFilter({
      kind: 'group',
      connector,
      children: callback(make<T>(emptyAst())).build().filters,
    })

  const query: Query<T> = {
    where: createWhere<T>('and', pushFilter),
    orWhere: createWhere<T>('or', pushFilter),
    whereGroup: callback => group('and', callback),
    orWhereGroup: callback => group('or', callback),
    include: (relation, callback) =>
      next({
        includes: [
          ...ast.includes,
          { relation, query: callback ? callback(make(emptyAst())).build() : emptyAst() },
        ],
      }),
    orderBy: (field, direction = 'asc') => next({ sorts: [...ast.sorts, { field, direction }] }),
    select: (...fields) => next({ selects: [...ast.selects, ...fields] }),
    search: text => next({ search: text }),
    limit: count => next({ limit: count }),
    page: number => next({ page: number }),
    extend: (target, value) => next({ extensions: { ...ast.extensions, [target]: value } }),
    build: () => ast,
    to: compiler => compiler(ast),
  }
  return query
}

export const query = <T = Record<string, unknown>>(): Query<T> => make<T>(emptyAst())

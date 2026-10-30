export type Operator = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'not in' | 'like' | 'not like'

export type Connector = 'and' | 'or'

export type Direction = 'asc' | 'desc'

export interface ConditionNode {
  kind: 'condition'
  field: string
  operator: Operator
  value: unknown
  connector: Connector
}

export interface GroupNode {
  kind: 'group'
  connector: Connector
  children: FilterNode[]
}

export type FilterNode = ConditionNode | GroupNode

export interface SortNode {
  field: string
  direction: Direction
}

export interface IncludeNode {
  relation: string
  query: QueryAst
}

export interface QueryAst {
  filters: FilterNode[]
  sorts: SortNode[]
  selects: string[]
  includes: IncludeNode[]
  search?: string
  limit?: number
  page?: number
  extensions: Record<string, unknown>
}

export type Compiler<TOutput> = (ast: QueryAst) => TOutput

export type FieldOf<T> = (keyof T & string) | `${string}.${string}`

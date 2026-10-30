import type { Compiler, FilterNode, QueryAst } from './types.ts'

export interface LomkitFilter {
  field?: string
  operator?: string
  value?: unknown
  nested?: LomkitFilter[]
  type?: 'or'
}

export interface LomkitSearch {
  filters?: LomkitFilter[]
  sorts?: { field: string, direction: string }[]
  selects?: { field: string }[]
  includes?: ({ relation: string } & LomkitSearch)[]
  text?: { value: string }
  limit?: number
  page?: number
  [key: string]: unknown
}

const compileFilter = (node: FilterNode): LomkitFilter => {
  const type = node.connector === 'or' ? { type: 'or' as const } : {}
  if (node.kind === 'group') return { nested: node.children.map(compileFilter), ...type }
  return { field: node.field, operator: node.operator, value: node.value, ...type }
}

const compileSearch = (ast: QueryAst): LomkitSearch => {
  const search: LomkitSearch = {}
  if (ast.filters.length > 0) search.filters = ast.filters.map(compileFilter)
  if (ast.sorts.length > 0) search.sorts = ast.sorts.map(sort => ({ ...sort }))
  if (ast.selects.length > 0) search.selects = ast.selects.map(field => ({ field }))
  if (ast.includes.length > 0) {
    search.includes = ast.includes.map(include => ({
      relation: include.relation,
      ...compileSearch(include.query),
    }))
  }
  if (ast.search !== undefined) search.text = { value: ast.search }
  if (ast.limit !== undefined) search.limit = ast.limit
  if (ast.page !== undefined) search.page = ast.page
  return { ...search, ...(ast.extensions.lomkit as LomkitSearch | undefined) }
}

export const toLomkit: Compiler<LomkitSearch> = compileSearch

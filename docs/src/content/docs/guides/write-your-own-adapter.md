---
title: Write your own adapter
description: The Compiler contract and the helpers an adapter uses.
---

An adapter is a pure function from a `Query` to whatever your backend expects.

```ts
type Compiler<TOutput> = (query: Query) => TOutput
```

Because it is a plain function, it works with `query().to(compiler)`.

## Rules

1. Call `assertQuery(query)` (or `prepareQuery`, same thing) first and use the returned copy. It validates a hand-made `Query` and guarantees the shape and the limits.
2. Throw on what your backend cannot express (aggregates, search, sub-queries). Never drop it silently.
3. Read your own extensions with `getExtension(query, 'your-target')`. The target is your adapter name, extensions for other targets are ignored.
4. Field names are only checked for length. Validate them for your syntax if they end up in a string or a path.
5. Package it as `dialectr-adapter-*` with `dialectr` as a peer dependency.

## Helpers

| Helper | Use |
|---|---|
| `assertQuery(query)` | Validate, return a deep copy |
| `groupByOr(nodes)` | Split nodes into AND clusters, joined by OR |
| `getExtension(query, target)` | Your extension payload or `undefined` |
| `parseLike(pattern)` | `{ literal, leading, trailing, inner }` |
| `containsPattern(pattern)` | Pattern wrapped in `%...%` when it has no wildcard |

`groupByOr` implements AND-before-OR: every node with `boolean: 'or'` starts a new cluster. Join nodes inside a cluster with AND and clusters with OR.

## Example

A compiler that returns a SQL-like `WHERE` string and a limit:

```ts
import { assertQuery, groupByOr } from 'dialectr'
import type { Compiler, FilterNode } from 'dialectr'

interface WhereClause {
  where: string
  limit?: number
}

const expression = (nodes: FilterNode[]): string =>
  groupByOr(nodes)
    .map(cluster =>
      cluster
        .map(node =>
          node.kind === 'group'
            ? `(${expression(node.nodes)})`
            : `${node.field} ${node.operator} ${JSON.stringify(node.value)}`,
        )
        .join(' AND '),
    )
    .join(' OR ')

export const toWhere: Compiler<WhereClause> = source => {
  const query = assertQuery(source)
  if (query.aggregates.length > 0) throw new Error('toWhere does not support aggregates')
  return {
    where: expression(query.filters),
    ...(query.limit === undefined ? {} : { limit: query.limit }),
  }
}
```

```ts
import { query } from 'dialectr'

query().where('a', 1).where('b', 2).orWhere('c', 3).limit(10).to(toWhere)
// { where: 'a = 1 AND b = 2 OR c = 3', limit: 10 }
```

## Query shape

`Query` is `{ filters, sorts, selects, includes, aggregates, search?, extensions?, limit?, page? }`. A filter node is a `Condition` (`field`, `operator`, `value`) or a `Group` (`nodes`), both with `boolean: 'and' | 'or'`. An `Include` holds a `relation` and its own `Query`. Look at the Lomkit, PocketBase and Strapi adapters in `packages/adapters` for complete examples.

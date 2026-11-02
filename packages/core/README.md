# dialectr

One query, every backend dialect. Zero-dependency query builder that compiles to lomkit, Strapi, PocketBase and more.

```ts
import { query } from 'dialectr'

const built = query<{ name: string; age: number }>()
  .where('age', '>=', 18)
  .sort('name')
  .limit(20)
  .build()
```

`build()` returns a plain, serializable, validated `Query`. Compile it with an adapter:

```ts
import { toPocketbase } from 'dialectr-adapter-pocketbase'

toPocketbase(built)
// { filter: 'age>=18', sort: 'name', perPage: 20 }
```

## API

Builder: `where`, `orWhere`, `whereGroup`, `orWhereGroup`, `sort`, `select`, `include`, `aggregate`, `search`, `extend`, `limit`, `page`, `build`, `to(compiler)`.

Helpers for adapter authors:

| Export | Role |
|---|---|
| `prepareQuery(query)` / `assertQuery(query)` | Validate and return a deep copy, throw on invalid input |
| `groupByOr(nodes)` | Split filter nodes into AND clusters joined by OR |
| `getExtension(query, target)` | Read `extensions[target]`, `undefined` when absent |
| `escapeLike(text)` | Escape `%`, `_` and `\` |
| `parseLike(pattern)` | `{ literal, leading, trailing, inner }` |
| `containsPattern(pattern)` | Wrap in `%...%` when there is no wildcard |

Types: `Query`, `Compiler<TOutput>`, `Condition`, `Group`, `FilterNode`, `Include`, `Aggregate`, `Sort`, `Operator`, `Connector`, `SortDirection`, `AggregateType`, `LikePattern`.

Limits: `MAX_NODES`, `MAX_DEPTH`, `MAX_LIST`, `MAX_LIMIT`, `MAX_PAGE`, `MAX_FIELD_LENGTH`, `MAX_VALUE_LENGTH`, `MAX_SEARCH_LENGTH`, `MAX_EXTENSION_KEYS`.

No runtime dependencies. Node.js 22 or later. Operators, `like` semantics, limits and the adapter guide are in the [repository README](../../README.md).

MIT
# dialectr

Universal query builder. Describe a query once, compile it for any backend.

```ts
import { query } from 'dialectr'
import { toLomkit } from 'dialectr-adapter-lomkit'
import { toPocketbase } from 'dialectr-adapter-pocketbase'
import { toStrapi } from 'dialectr-adapter-strapi'

const users = query<{ name: string; age: number }>()
  .where('age', '>=', 18)
  .orWhere('name', 'like', 'A%')
  .sort('name')
  .limit(20)
  .build()

toLomkit(users)     // { search: { filters: [...], sorts: [...], limit: 20 } }
toPocketbase(users) // { filter: "(age>=18) || (name~'A%')", sort: 'name', perPage: 20 }
toStrapi(users)     // { filters: { $or: [...] }, sort: ['name:asc'], pagination: {...} }
```

> **Keywords** — `query-builder` · `typescript` · `adapters` · `filters` · `lomkit` · `pocketbase` · `strapi` · `backend-agnostic` · `zero-dependencies`

## Packages

| Package | Role |
|---|---|
| [`dialectr`](packages/core) | The builder and the neutral query description. No dependencies. |
| [`dialectr-adapter-lomkit`](packages/adapters/lomkit) | Laravel + Lomkit search payload. |
| [`dialectr-adapter-pocketbase`](packages/adapters/pocketbase) | PocketBase `filter`, `sort`, `fields`, `expand`, pagination. |
| [`dialectr-adapter-strapi`](packages/adapters/strapi) | Strapi v5 `filters`, `sort`, `populate`, `pagination`. |

An adapter is a pure function from a `Query` to the backend's native parameters. Write your own and publish it as `dialectr-adapter-*`.

## Builder

- `where(field, value)` / `where(field, operator, value)` / `orWhere(...)`
- `whereGroup(cb)` / `orWhereGroup(cb)` for nested conditions
- `sort(field, direction?)`, `select(...fields)`, `limit(n)`, `page(n)`
- `include(relation, cb?)`, `aggregate(type, relation, { field?, where? })`
- `build()` returns a plain, serializable `Query`

Operators: `=` `!=` `>` `>=` `<` `<=` `like` `not like` `in` `not in`. The builder is immutable, and fields are typed from the interface you pass to `query<T>()`.

`AND` binds tighter than `OR`, as in SQL. An adapter that cannot express something (for example aggregates on PocketBase or Strapi) throws instead of dropping it silently.

## Use with nexdk

dialectr has no dependency on nexdk. Pass the compiled payload to a nexdk driver call, for example `sdk.lomkit.users.get(toLomkit(users))`.

## License

MIT © techmefr

# dialectr

One query, every backend dialect. Zero-dependency query builder that compiles to lomkit, Strapi, PocketBase and more.

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
| [`dialectr`](packages/core) | The builder and the neutral query description. No runtime dependencies. |
| [`dialectr-adapter-lomkit`](packages/adapters/lomkit) | Laravel + Lomkit search payload. |
| [`dialectr-adapter-pocketbase`](packages/adapters/pocketbase) | PocketBase `filter`, `sort`, `fields`, `expand`, pagination. |
| [`dialectr-adapter-strapi`](packages/adapters/strapi) | Strapi v5 `filters`, `sort`, `populate`, `pagination`. |

An adapter is a pure function from a `Query` to the backend's native parameters. Write your own and publish it as `dialectr-adapter-*`. Adapters list `dialectr` as a peer dependency and should call `assertQuery(query)` first.

## Builder

- `where(field, value)` / `where(field, operator, value)` / `orWhere(...)`
- `whereGroup(cb)` / `orWhereGroup(cb)` for nested conditions
- `sort(field, direction?)`, `select(...fields)`, `limit(n)`, `page(n)`
- `search(text)` sets free-text search (non-empty, at most 1024 characters)
- `extend(target, value)` attaches a backend-specific payload, see Extensions
- `to(compiler)` runs any `Compiler<TOutput>` (`(query: Query) => TOutput`) on the built query, e.g. `query().to(toLomkit)`
- `include(relation, cb?)`, `aggregate(type, relation, { field?, where? })`
- `build()` returns a plain, serializable `Query`

Operators: `=` `!=` `>` `>=` `<` `<=` `like` `not like` `in` `not in`. The builder is immutable, and fields are typed from the interface you pass to `query<T>()`.

`AND` binds tighter than `OR`, as in SQL. An adapter that cannot express something (for example aggregates on PocketBase or Strapi) throws instead of dropping it silently.

## Search and extensions

`search(text)` stores free text on the query. Lomkit sends it as `search.text = { value }`. PocketBase and Strapi have no equivalent and throw "does not support free-text search".

`extend(target, value)` is the escape hatch for backend-specific options. The target is an adapter name: `lomkit`, `pocketbase` or `strapi`. An adapter only reads its own target and ignores the others without error, so one query can carry options for several backends.

```ts
query().where('age', '>=', 18).extend('lomkit', { scopes: [{ name: 'active' }] }).to(toLomkit)
```

- Lomkit merges `extensions.lomkit` into the search. Accepted keys: `scopes`, `instructions`, `gates` (arrays). Any other key, including core ones such as `filters` or `limit`, throws.
- PocketBase and Strapi have nothing to merge: an extension aimed at them throws.
- Targets and nested keys named `__proto__`, `constructor` or `prototype` are rejected. Values must be JSON-like (plain objects, arrays, strings, finite numbers, booleans, null, valid dates) and are copied when stored and when built.

## Validation and limits


Everything is validated when the query is built and again by each adapter, so a hand-made `Query` object gets the same checks.

- Values are `string`, finite `number`, `boolean`, `null`, `undefined` (sent as `null`) or a valid `Date`. Objects, arrays (outside `in` / `not in`), functions, `NaN` and `Infinity` throw.
- `in` / `not in` take an array of those scalars. `like` / `not like` take a string.
- Operators are looked up in a closed list; anything else (`__proto__`, `constructor`, `undefined`...) throws.
- Sort direction must be `asc` or `desc`.
- Empty filter groups in a hand-made query throw. The builder itself skips empty groups.
- Values are copied when passed in and when built, so mutating an array or a `Date` afterwards does not change the builder. Only the scalar values above are supported.
- Bounds, exported from the core: `MAX_DEPTH` (32 levels of groups or nested includes), `MAX_NODES` (1000 filters, sorts, selects, includes and aggregates in total), `MAX_LIST` (10000 items in an `in` list), `MAX_LIMIT` (10000, enforced by `limit()`), `MAX_FIELD_LENGTH` (256). Exceeding them throws a clear error.
- Strapi: field, sort, select and relation names are dot-separated segments matching `[A-Za-z_][A-Za-z0-9_]*`. A segment starting with `$` is rejected, so a field cannot smuggle in an operator. `include('*')` is refused.
- PocketBase: names match `[A-Za-z_][A-Za-z0-9_.:]*`. An `include` with its own filters, sorts, selects, nested includes, aggregates or pagination throws, because `expand` cannot express it.

## like

`like` and `not like` take a SQL-style pattern: `%` at the start and/or end, `\` to escape.

| Pattern | Meaning | Strapi | PocketBase | Lomkit |
|---|---|---|---|---|
| `x%` | starts with | `$startsWithi` | `~'x%'` | `like 'x%'` |
| `%x` | ends with | `$endsWithi` | `~'%x'` | `like '%x'` |
| `%x%` | contains | `$containsi` | `~'%x%'` | `like '%x%'` |
| `x` (no wildcard) | contains, case-insensitive | `$containsi` | `~'%x%'` | `like '%x%'` |
| `a%b`, `a_b` | inner wildcard | error | passed through | passed through |

Wildcards inside a user-supplied value are not escaped automatically. Use `escapeLike` for the literal part:

```ts
import { escapeLike, query } from 'dialectr'

query().where('title', 'like', `%${escapeLike(userInput)}%`).build()
```

`escapeLike` prefixes `%`, `_` and `\` with a backslash. `parseLike(pattern)` and `containsPattern(pattern)` are exported for adapter authors. Strapi cannot express inner wildcards and throws on them. Case sensitivity and backslash escaping on Lomkit depend on your database and collation.

## Use with nexdk

dialectr has no dependency on nexdk. Pass the compiled payload to a nexdk driver call, for example `sdk.lomkit.users.get(toLomkit(users))`.

## Requirements

Node.js 18 or later.

## License

MIT © techmefr

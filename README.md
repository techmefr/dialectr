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
  .page(2)
  .build()

toLomkit(users)
toPocketbase(users)
toStrapi(users)
```

```ts
toLomkit(users)
// { search: { filters: [
//     { field: 'age', operator: '>=', value: 18 },
//     { field: 'name', operator: 'like', value: 'A%', type: 'or' }
//   ], sorts: [{ field: 'name', direction: 'asc' }], limit: 20, page: 2 } }

toPocketbase(users)
// { filter: "(age>=18) || (name~'A%')", sort: 'name', page: 2, perPage: 20 }

toStrapi(users)
// { filters: { $or: [{ age: { $gte: 18 } }, { name: { $startsWithi: 'A' } }] },
//   sort: ['name:asc'], pagination: { page: 2, pageSize: 20 } }
```

## Packages

| Package | Role |
|---|---|
| [`dialectr`](packages/core) | The builder and the neutral `Query`. No runtime dependencies. |
| [`dialectr-adapter-lomkit`](packages/adapters/lomkit) | Laravel Lomkit `{ search }` payload. |
| [`dialectr-adapter-pocketbase`](packages/adapters/pocketbase) | PocketBase `filter`, `sort`, `fields`, `expand`, `page`, `perPage`. |
| [`dialectr-adapter-strapi`](packages/adapters/strapi) | Strapi v5 `filters`, `sort`, `fields`, `populate`, `pagination`. |

Nothing is published to npm yet. Build from source:

```bash
pnpm install
pnpm build
pnpm test
```

Node.js 22 or later.

## Builder

`query<T>()` returns an immutable builder. Field names are typed from `T`.

| Method | Effect |
|---|---|
| `where(field, value)` / `where(field, operator, value)` | AND condition, operator defaults to `=` |
| `orWhere(...)` | OR condition |
| `whereGroup(cb)` / `orWhereGroup(cb)` | Nested group, empty groups are skipped |
| `sort(field, direction?)` | `'asc'` (default) or `'desc'` |
| `select(...fields)` | Fields to return |
| `include(relation, cb?)` | Load a relation, optionally constrained by a sub-query |
| `aggregate(type, relation, { field?, where? })` | `count`, `min`, `max`, `avg`, `sum`, `exists` |
| `search(text)` | Free-text search, non-empty, at most 1024 characters |
| `extend(target, value)` | Backend-specific options, see below |
| `limit(n)` / `page(n)` | Positive integers |
| `build()` | Returns a validated, serializable `Query` |
| `to(compiler)` | `compiler(build())` |

Operators: `=` `!=` `>` `>=` `<` `<=` `like` `not like` `in` `not in`.

```ts
query<{ id: number }>().where('id', 'in', [1, 2, 3]).to(toPocketbase)
```

`to(compiler)` accepts any `Compiler<TOutput>`, that is `(query: Query) => TOutput`.

### AND before OR

`AND` binds tighter than `OR`, as in SQL. `a AND b OR c AND d` means `(a AND b) OR (c AND d)`.

```ts
const q = query().where('a', 1).where('b', 2).orWhere('c', 3).where('d', 4).build()

toPocketbase(q)
// { filter: '(a=1 && b=2) || (c=3 && d=4)' }
```

Use `whereGroup` to change the grouping:

```ts
const q = query()
  .where('active', true)
  .whereGroup(group => group.where('role', 'admin').orWhere('role', 'editor'))
  .build()

toPocketbase(q)
// { filter: "active=true && ((role='admin') || (role='editor'))" }
```

### Include and aggregate

```ts
const q = query()
  .select('id', 'name')
  .include('posts', posts => posts.where('published', true).sort('title', 'desc').limit(5))
  .build()

toLomkit(q)
// { search: { selects: [{ field: 'id' }, { field: 'name' }],
//   includes: [{ relation: 'posts', filters: [...], sorts: [...], limit: 5 }] } }

toStrapi(q)
// { fields: ['id', 'name'],
//   populate: { posts: { filters: { published: { $eq: true } }, sort: ['title:desc'], pagination: { pageSize: 5 } } } }
```

PocketBase `expand` cannot be constrained: an `include` with a sub-query throws. A plain `include('posts')` works everywhere.

Aggregates are Lomkit only:

```ts
query().aggregate('count', 'posts', { where: posts => posts.where('published', true) }).to(toLomkit)
// { search: { aggregates: [{ relation: 'posts', type: 'count', filters: [...] }] } }
```

PocketBase and Strapi throw `does not support aggregates`. An adapter never drops something silently.

## like

`like` and `not like` take a SQL-style pattern: `%` at the start and/or end, `\` to escape `%` and `_`.

| Pattern | Meaning | Lomkit | PocketBase | Strapi |
|---|---|---|---|---|
| `x%` | starts with | `like 'x%'` | `~'x%'` | `$startsWithi` |
| `%x` | ends with | `like '%x'` | `~'%x'` | `$endsWithi` |
| `%x%` | contains | `like '%x%'` | `~'%x%'` | `$containsi` |
| `x` (no wildcard) | contains, case-insensitive | `like '%x%'` | `~'%x%'` | `$containsi` |
| `a%b`, `a_b` | inner wildcard | passed through | passed through | error |

Wildcards in user input are not escaped for you. Wrap the literal part with `escapeLike`:

```ts
import { escapeLike, query } from 'dialectr'

query().where('title', 'like', `%${escapeLike('50%')}%`).build()
```

`escapeLike('50%')` gives `50\%`. Case sensitivity of `like` on Lomkit depends on your database and collation.

## Search and extend

`search(text)` stores free text. Lomkit sends it as `search.text = { value }`. PocketBase and Strapi throw `does not support free-text search`.

`extend(target, value)` carries backend-specific options. The target is an adapter name (`lomkit`, `pocketbase`, `strapi`). An adapter reads only its own target and ignores the others, so one query can carry options for several backends.

```ts
const q = query().search('john').extend('lomkit', { scopes: [{ name: 'active' }] }).build()

toLomkit(q)
// { search: { text: { value: 'john' }, scopes: [{ name: 'active' }] } }
```

- Lomkit merges `scopes`, `instructions` and `gates` (arrays). Any other key, such as `filters`, throws.
- PocketBase and Strapi accept no extension for their own target: it throws.
- `getExtension(query, target)` reads an extension, returning `undefined` when absent.

## Values

- `string` (at most 4096 characters), finite `number`, `boolean`, `null`, `undefined` or a valid `Date`.
- `undefined` becomes `null` and `Date` becomes an ISO string on Lomkit and Strapi. PocketBase writes dates as `'2026-01-02 03:04:05.000Z'`.
- `in` and `not in` take an array of those values. `like` and `not like` take a string.
- Objects, nested arrays, functions, `NaN` and `Infinity` throw.

```ts
query().where('deletedAt', undefined).where('createdAt', '>', new Date('2026-01-02T03:04:05Z')).to(toLomkit)
// { search: { filters: [
//   { field: 'deletedAt', operator: '=', value: null },
//   { field: 'createdAt', operator: '>', value: '2026-01-02T03:04:05.000Z' }] } }
```

## Validation and limits

`build()` returns a validated deep copy (a snapshot), and each adapter validates again through `prepareQuery`, so a hand-made `Query` object gets the same checks. Mutating a value after passing it in changes nothing.

`assertQuery(query)` and `prepareQuery(query)` return the validated copy and throw on anything invalid: unknown operator, bad direction, empty group, sparse array, forbidden key (`__proto__`, `constructor`, `prototype`).

Limits are exported from the core:

| Constant | Value | Applies to |
|---|---|---|
| `MAX_NODES` | 1000 | Shared budget: filters, sorts, selects, includes, aggregates, `in` list items and extension entries |
| `MAX_DEPTH` | 32 | Nested groups, includes and extension values |
| `MAX_LIST` | 10000 | Items in one `in` list (still counted in `MAX_NODES`) |
| `MAX_LIMIT` | 10000 | `limit()` |
| `MAX_PAGE` | 1000000 | `page()` |
| `MAX_FIELD_LENGTH` | 256 | Field, relation and extension target names |
| `MAX_VALUE_LENGTH` | 4096 | Strings and `like` patterns |
| `MAX_SEARCH_LENGTH` | 1024 | `search()` text |
| `MAX_EXTENSION_KEYS` | 32 | Extension targets per query |

Adapter name rules:

- Strapi: dot-separated segments matching `[A-Za-z_][A-Za-z0-9_]*`, so a field cannot start with `$` and smuggle in an operator. `include('*')` is refused.
- PocketBase: names match `[A-Za-z_][A-Za-z0-9_.:]*`. String values are escaped.

## Write your own adapter

An adapter is a pure function `(query: Query) => TOutput`. See [Write your own adapter](docs/src/content/docs/guides/write-your-own-adapter.md).

## Ecosystem

Same author, same spirit: small, simple, modular.

- [nexdk](https://github.com/techmefr/nexdk): a frontend SDK that talks to any backend through one grammar. Pass a compiled payload to a driver, for example `sdk.lomkit.users.get(toLomkit(users))`. dialectr does not depend on nexdk.
- [shamock](https://github.com/techmefr/shamock)
- [beepr](https://github.com/techmefr/beepr)

## License

MIT, see [LICENSE](LICENSE).

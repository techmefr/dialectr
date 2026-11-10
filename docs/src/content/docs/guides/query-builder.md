---
title: Query builder
description: Every builder method, operators and precedence.
---

`query<T>()` returns an immutable builder. Field names are typed from `T`.

| Method | Effect |
|---|---|
| `where(field, value)` / `where(field, operator, value)` | AND condition, operator defaults to `=` |
| `orWhere(...)` | OR condition |
| `whereGroup(cb)` / `orWhereGroup(cb)` | Nested group, empty groups are skipped |
| `sort(field, direction?)` | `'asc'` (default) or `'desc'` |
| `select(...fields)` | Fields to return |
| `include(relation, cb?)` | Load a relation, optionally constrained |
| `aggregate(type, relation, { field?, alias?, where? })` | `count`, `min`, `max`, `avg`, `sum`, `exists` |
| `search(text)` | Free-text search |
| `whereIf(field, [operator,] value)` / `orWhereIf(...)` | Like `where`, skipped when the value is `undefined`, `null`, `''` or `[]` |
| `when(condition, cb)` | Applies `cb(builder, condition)` only when `condition` is truthy |
| `extend(target, value)` | Backend-specific options |
| `limit(n)` / `page(n)` | Positive integers. `page(n)` without `limit(n)` makes `build()` and `to()` throw `page() requires limit()` |
| `build()` | Validated, serializable `Query` |
| `to(compiler)` | `compiler(build())` |

Operators: `=` `!=` `>` `>=` `<` `<=` `like` `not like` `in` `not in`.

The value is typed from the field when `T` is given: `query<User>().where('age', '>=', 'abc')` and `where('name', 'like', 5)` do not compile.

| Operator | Value |
|---|---|
| `=` `!=` `>` `>=` `<` `<=` | The type of the field |
| `in` `not in` | An array of the type of the field |
| `like` `not like` | A string |

Without a type (`query()`) every value stays permissive. Fields outside the keys of `T`, such as nested `a.b`, are not accepted when `T` is given.

## AND before OR

`AND` binds tighter than `OR`, as in SQL.

```ts
import { query } from 'dialectr'
import { toPocketbase } from 'dialectr-adapter-pocketbase'

const q = query().where('a', 1).where('b', 2).orWhere('c', 3).where('d', 4).build()

toPocketbase(q)
// { filter: '(a=1 && b=2) || (c=3 && d=4)' }
```

Groups change the grouping:

```ts
const q = query()
  .where('active', true)
  .whereGroup(group => group.where('role', 'admin').orWhere('role', 'editor'))
  .build()

toPocketbase(q)
// { filter: "active=true && ((role='admin') || (role='editor'))" }
```

Builders are immutable: `group.where(...)` returns a new builder and leaves `group` untouched. The callback of `whereGroup`, `orWhereGroup`, `include` and the `where` option of `aggregate` must return the chained result. Returning the builder it received, or nothing, throws an error that says so, instead of silently dropping the group:

```ts
query().whereGroup(group => {
  group.where('a', '=', 1)
  return group
})

query().whereGroup(group => group.where('a', '=', 1).where('b', '=', 2))
```

The first call throws, the second is correct. To add conditions in a loop, reassign: `group = group.where(...)`.

## Optional filters

Building a query from optional inputs used to need a ternary and `.filter(Boolean)`. Use `whereIf` and `when`.

```ts
const filters = [
  status ? { field: 'status', operator: '=', value: status } : null,
  ids.length > 0 ? { field: 'id', operator: 'in', value: ids } : null,
].filter(Boolean)

query<Order>()
  .whereIf('status', status)
  .whereIf('id', 'in', ids)
  .when(search, (builder, text) => builder.search(text))
  .when(onlyMine, builder => builder.extend('lomkit', { scopes: [{ name: 'mine' }] }))
```

`whereIf` skips `undefined`, `null`, `''` and `[]`; `0` and `false` are real values. `where(field, 'in', [])` is unchanged: it still matches nothing. `when` follows the immutability rule: the callback must return the chained builder, otherwise it throws.

## Nested includes

A dotted path loads a nested relation and the callback applies to the last segment. Lomkit compiles it to nested `includes` and merges paths that share a prefix.

```ts
query().include('posts.comments', comments => comments.where('approved', true)).to(toLomkit)
// { search: { includes: [{ relation: 'posts', includes: [{ relation: 'comments', filters: [...] }] }] } }
```

## like

`%` at the start and/or end, `\` escapes `%` and `_`. A pattern without a wildcard means contains, case-insensitive.

| Pattern | Meaning | Lomkit | PocketBase | Strapi |
|---|---|---|---|---|
| `x%` | starts with | `like 'x%'` | `~'x%'` | `$startsWithi` |
| `%x` | ends with | `like '%x'` | `~'%x'` | `$endsWithi` |
| `%x%` | contains | `like '%x%'` | `~'%x%'` | `$containsi` |
| `x` | contains | `like '%x%'` | `~'%x%'` | `$containsi` |
| `a%b`, `a_b` | inner wildcard | passed through | passed through | error |

User input is not escaped for you. Use `escapeLike`:

```ts
import { escapeLike, query } from 'dialectr'

query().where('title', 'like', `%${escapeLike('50%')}%`).build()
```

:::caution[SQLite]
`escapeLike` relies on `\` as the LIKE escape character. MySQL and PostgreSQL honour it. SQLite has no default escape character and Lomkit (Laravel) sends no `ESCAPE` clause, so on a Lomkit backend running SQLite the `\` is a literal character: `escapeLike('100%')` matches nothing. This is a limit of the backend, not of the adapter. On SQLite, avoid user input in `like`, or pass it without `escapeLike` and accept that `%` and `_` stay wildcards. `like` is also ASCII-only case-insensitive on SQLite.
:::

## Search and extend

`search(text)` is Lomkit only, emitted as `search.text = { value }`. PocketBase and Strapi throw.

`extend(target, value)` targets one adapter by name. Other adapters ignore it.

```ts
import { toLomkit } from 'dialectr-adapter-lomkit'

query().search('john').extend('lomkit', { scopes: [{ name: 'active' }] }).to(toLomkit)
// { search: { text: { value: 'john' }, scopes: [{ name: 'active' }] } }
```

Lomkit accepts `gates` (`create`, `view`, `update`, `delete`, `restore`, `forceDelete`), `scopes` (`{ name, parameters? }`) and `instructions` (`{ name, fields?: { name, value }[] }`), typed once `dialectr-adapter-lomkit` is imported, and rejects any other key. Fields such as `title.keyword` (Scout) are passed through unchanged in filters and sorts. PocketBase and Strapi throw on an extension aimed at them.

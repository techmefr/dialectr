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

## Search and extend

`search(text)` is Lomkit only, emitted as `search.text = { value }`. PocketBase and Strapi throw.

`extend(target, value)` targets one adapter by name. Other adapters ignore it.

```ts
import { toLomkit } from 'dialectr-adapter-lomkit'

query().search('john').extend('lomkit', { scopes: [{ name: 'active' }] }).to(toLomkit)
// { search: { text: { value: 'john' }, scopes: [{ name: 'active' }] } }
```

Lomkit accepts `scopes`, `instructions` and `gates` (arrays) and rejects any other key. PocketBase and Strapi throw on an extension aimed at them.

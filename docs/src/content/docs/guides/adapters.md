---
title: Adapters
description: What each adapter produces and what it refuses.
---

| Feature | Lomkit | PocketBase | Strapi |
|---|---|---|---|
| Filters, groups, `in`, `like` | yes | yes | yes, no inner wildcards |
| `sort`, `select`, `limit`, `page` (needs `limit`) | yes | yes | yes |
| `include` | nested search | `expand`, no sub-query | `populate`, with sub-query |
| `aggregate` | yes | throws | throws |
| `search` | `search.text` | throws | throws |
| `extend` | `scopes`, `instructions`, `gates` | throws | throws |

An adapter throws instead of dropping something silently.

## Lomkit

```ts
import { query } from 'dialectr'
import { toLomkit } from 'dialectr-adapter-lomkit'

query()
  .aggregate('count', 'posts', { where: posts => posts.where('published', true) })
  .to(toLomkit)
// { search: { aggregates: [{ relation: 'posts', type: 'count',
//   filters: [{ field: 'published', operator: '=', value: true }] }] } }
```

`orWhere` becomes `type: 'or'`, groups become `nested`. `undefined` becomes `null`, `Date` becomes `YYYY-MM-DD HH:mm:ss` in UTC (Laravel's native format, which SQLite compares as text).

`in []` is sent as `value: [null]` and `not in []` is removed (inside an `or` it makes the whole group true). Aggregates sharing type, relation and field get a unique `alias`; pass `alias` to name one. See the [Lomkit backend constraints](https://github.com/techmefr/dialectr/blob/main/packages/adapters/lomkit/README.md#backend-constraints).

## PocketBase

```ts
import { toPocketbase } from 'dialectr-adapter-pocketbase'

query().select('id').include('posts').to(toPocketbase)
// { fields: 'id', expand: 'posts' }
```

Strings are escaped and field names must match `[A-Za-z_][A-Za-z0-9_.:]*`.

An empty `in` becomes `1=0` and an empty `not in` becomes `1=1`, because PocketBase rejects a bare `true` or `false`. Pass dates as `Date`: they are written like PocketBase stores them (`2026-01-02 03:04:05.000Z`). A string is sent as is, and an ISO string with a `T` shifts a comparison on the exact boundary.

## Strapi

```ts
import { toStrapi } from 'dialectr-adapter-strapi'

query()
  .include('posts', posts => posts.where('published', true).sort('title', 'desc').limit(5))
  .to(toStrapi)
// { populate: { posts: { filters: { published: { $eq: true } },
//   sort: ['title:desc'], pagination: { pageSize: 5 } } } }
```

Field names are dot-separated segments matching `[A-Za-z_][A-Za-z0-9_]*`. A segment cannot start with `$`, and `include('*')` throws `Strapi wildcard include is not supported`.

`= null` becomes `$null: true` and `!= null` becomes `$notNull: true`. `in []` becomes a condition that matches nothing and `not in []` is removed. Strapi silently caps `pageSize` at 100, so `limit` above 100 throws; pass `toStrapi(query, { maxPageSize })` if your server raised the cap.

---
title: Adapters
description: What each adapter produces and what it refuses.
---

| Feature | Lomkit | PocketBase | Strapi |
|---|---|---|---|
| Filters, groups, `in`, `like` | yes | yes | yes, no inner wildcards |
| `sort`, `select`, `limit`, `page` | yes | yes | yes |
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

`orWhere` becomes `type: 'or'`, groups become `nested`. `undefined` becomes `null`, `Date` becomes an ISO string.

## PocketBase

```ts
import { toPocketbase } from 'dialectr-adapter-pocketbase'

query().select('id').include('posts').to(toPocketbase)
// { fields: 'id', expand: 'posts' }
```

Strings are escaped and field names must match `[A-Za-z_][A-Za-z0-9_.:]*`.

## Strapi

```ts
import { toStrapi } from 'dialectr-adapter-strapi'

query()
  .include('posts', posts => posts.where('published', true).sort('title', 'desc').limit(5))
  .to(toStrapi)
// { populate: { posts: { filters: { published: { $eq: true } },
//   sort: ['title:desc'], pagination: { pageSize: 5 } } } }
```

Field names are dot-separated segments matching `[A-Za-z_][A-Za-z0-9_]*`. A segment cannot start with `$`, and `include('*')` is refused.

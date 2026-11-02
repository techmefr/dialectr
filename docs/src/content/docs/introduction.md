---
title: Introduction
description: What dialectr is and how to use it.
---

dialectr is a query builder with no runtime dependency. It does not talk to a backend. It builds a neutral, serializable `Query`, and an adapter compiles it to the parameters a backend expects.

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
toPocketbase(users)
// { filter: "(age>=18) || (name~'A%')", sort: 'name', page: 2, perPage: 20 }

toStrapi(users)
// { filters: { $or: [{ age: { $gte: 18 } }, { name: { $startsWithi: 'A' } }] },
//   sort: ['name:asc'], pagination: { page: 2, pageSize: 20 } }
```

## Packages

| Package | Role |
|---|---|
| `dialectr` | The builder and the neutral `Query` |
| `dialectr-adapter-lomkit` | Laravel Lomkit `{ search }` payload |
| `dialectr-adapter-pocketbase` | PocketBase `filter`, `sort`, `fields`, `expand`, `page`, `perPage` |
| `dialectr-adapter-strapi` | Strapi v5 `filters`, `sort`, `fields`, `populate`, `pagination` |

Nothing is published to npm yet. Build from source:

```bash
pnpm install
pnpm build
```

Node.js 22 or later.

# dialectr-adapter-strapi

Compile a dialectr query into Strapi v5 `filters`, `sort`, `fields`, `populate` and `pagination`.

```ts
import { query } from 'dialectr'
import { toStrapi } from 'dialectr-adapter-strapi'

query().where('age', '>=', 18).sort('name').limit(20).to(toStrapi)
// { filters: { age: { $gte: 18 } }, sort: ['name:asc'], pagination: { pageSize: 20 } }
```

- `like` maps to `$startsWithi`, `$endsWithi` or `$containsi`. Inner wildcards (`a%b`, `a_b`) throw.
- `include` becomes `populate`: an array for plain relations, an object when a relation has its own sub-query.
- Field names are dot-separated segments matching `[A-Za-z_][A-Za-z0-9_]*`. A segment cannot start with `$`, and `include('*')` is refused.
- `aggregate`, `search` and `extend('strapi', ...)` throw, Strapi has no equivalent. Extensions for other targets are ignored.

`dialectr` is a peer dependency. Node.js 22 or later. See the [repository README](../../../README.md).

MIT
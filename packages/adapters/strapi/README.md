# dialectr-adapter-strapi

Compile a dialectr query into Strapi v5 `filters`, `sort`, `fields`, `populate` and `pagination`.

```ts
import { query } from 'dialectr'
import { toStrapi } from 'dialectr-adapter-strapi'

query().where('age', '>=', 18).sort('name').limit(20).to(toStrapi)
// { filters: { age: { $gte: 18 } }, sort: ['name:asc'], pagination: { pageSize: 20 } }
```

- `like` maps to `$startsWithi`, `$endsWithi` or `$containsi`. Inner wildcards (`a%b`, `a_b`) throw.
- `page` requires `limit`: a query with a page and no limit throws.
- `include` becomes `populate`: an array for plain relations, an object when a relation has its own sub-query.
- Field names are dot-separated segments matching `[A-Za-z_][A-Za-z0-9_]*`. A segment cannot start with `$`, and `include('*')` throws `Strapi wildcard include is not supported`.
- `= null` becomes `$null: true` and `!= null` becomes `$notNull: true`. Any other operator with `null` throws.
- `in []` becomes `{ $and: [{ f: { $null: true } }, { f: { $notNull: true } }] }` (matches nothing, because the driver does not transport an empty array). `not in []` is removed, and inside an `or` it makes the group true.
- Strapi silently caps `pageSize` at 100. `limit` above 100 throws; pass `toStrapi(query, { maxPageSize })` when the server raised `api.rest.maxLimit`.
- Backend semantics: `!=` and `not like` exclude rows where the field is null (SQL), `$containsi` is ASCII-only on SQLite, a `like` without wildcard is a contains, and deleting an unknown id succeeds.
- `aggregate`, `search` and `extend('strapi', ...)` throw, Strapi has no equivalent. Extensions for other targets are ignored.

`dialectr` is a peer dependency. Node.js 22 or later. See the [repository README](../../../README.md).

MIT
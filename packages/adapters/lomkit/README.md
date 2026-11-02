# dialectr-adapter-lomkit

Compile a dialectr query into a Laravel Lomkit `{ search }` payload.

```ts
import { query } from 'dialectr'
import { toLomkit } from 'dialectr-adapter-lomkit'

query().where('age', '>=', 18).sort('name').to(toLomkit)
// { search: { filters: [{ field: 'age', operator: '>=', value: 18 }],
//             sorts: [{ field: 'name', direction: 'asc' }] } }
```

- Supports includes (each include is a nested search) and aggregates.
- `page` requires `limit`: a query with a page and no limit throws.
- `orWhere` becomes `type: 'or'`, groups become `nested`.
- `search(text)` is emitted as `search.text = { value }`.
- `extend('lomkit', { scopes, instructions, gates })` is merged into the search. Each value must be an array, any other key throws, extensions for other targets are ignored.
- `like` without a wildcard is sent as `%value%` (contains).
- `undefined` becomes `null`. `Date` becomes `YYYY-MM-DD HH:mm:ss` in UTC, without milliseconds: Laravel's native format, accepted by MySQL, PostgreSQL and SQLite. An ISO string is compared as text on SQLite and breaks equality and boundary comparisons, so pass a `Date` rather than an ISO string.
- `in []` is sent as `value: [null]` (Lomkit answers 422 on an empty list; `[null]` is accepted and matches nothing). `not in []` is removed from the filters; inside an `or` it makes the whole group true.
- Aggregates sharing type, relation and field get a unique `alias` (`posts_count`, `posts_count_2`, ...). Pass `aggregate(type, relation, { alias })` to name one.

## Backend constraints

These come from `lomkit/laravel-rest-api` and your resource, not from the adapter.

- `search(text)` uses Laravel Scout. Lomkit refuses it combined with filters, sorts or scopes (422), and `like` filters cannot be guaranteed alongside it. Send text search alone.
- `limits()` on the resource decides the allowed `limit` values; the default is 50 rows when no `limit` is sent. Send a `limit` your resource allows.
- `max_nesting_depth` (default 1) caps nested filter groups and includes. A deeper query answers 422.
- Deleting an unknown id answers 422.
- `escapeLike` uses `\` as escape character: it works on MySQL and PostgreSQL, but on SQLite `\` is a literal character and `escapeLike('100%')` matches nothing. `like` is ASCII-only case-insensitive on SQLite.

`dialectr` is a peer dependency. Node.js 22 or later. See the [repository README](../../../README.md).

MIT
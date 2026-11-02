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
- `orWhere` becomes `type: 'or'`, groups become `nested`.
- `search(text)` is emitted as `search.text = { value }`.
- `extend('lomkit', { scopes, instructions, gates })` is merged into the search. Each value must be an array, any other key throws, extensions for other targets are ignored.
- `like` without a wildcard is sent as `%value%` (contains).
- `undefined` becomes `null` and `Date` becomes an ISO string.

`dialectr` is a peer dependency. Node.js 22 or later. See the [repository README](../../../README.md).

MIT
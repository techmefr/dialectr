# dialectr-adapter-pocketbase

Compile a dialectr query into PocketBase `filter`, `sort`, `fields`, `expand`, `page` and `perPage`.

```ts
import { query } from 'dialectr'
import { toPocketbase } from 'dialectr-adapter-pocketbase'

query().where('age', '>=', 18).sort('name', 'desc').limit(20).to(toPocketbase)
// { filter: 'age>=18', sort: '-name', perPage: 20 }
```

- `like` without a wildcard means contains, case-insensitive.
- `in` / `not in` become `||` / `&&` chains.
- String values are escaped, field names must match `[A-Za-z_][A-Za-z0-9_.:]*`.
- `include('posts')` becomes `expand`. An include with filters, sorts, selects, nested includes or pagination throws.
- `aggregate`, `search` and `extend('pocketbase', ...)` throw, PocketBase has no equivalent. Extensions for other targets are ignored.

`dialectr` is a peer dependency. Node.js 22 or later. See the [repository README](../../../README.md).

MIT
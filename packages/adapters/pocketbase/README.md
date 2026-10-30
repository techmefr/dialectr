# dialectr-adapter-pocketbase

Compile a dialectr query into PocketBase `filter`, `sort`, `fields`, `expand`, `page` and `perPage`.

```ts
import { query } from 'dialectr'
import { toPocketbase } from 'dialectr-adapter-pocketbase'

toPocketbase(query().where('age', '>=', 18).sort('name').build())
```

Aggregates and constrained includes throw. Values are escaped, field names are validated, and `like` without a wildcard means contains. Requires `dialectr` as a peer dependency and Node.js 18 or later. See the repository root README.

MIT

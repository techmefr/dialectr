# dialectr-adapter-lomkit

Compile a dialectr query into a Laravel Lomkit `{ search }` payload, including nested includes and aggregates.

```ts
import { query } from 'dialectr'
import { toLomkit } from 'dialectr-adapter-lomkit'

toLomkit(query().where('age', '>=', 18).sort('name').build())
```

`like` without a wildcard is sent as `%value%` (contains). Requires `dialectr` as a peer dependency and Node.js 18 or later. See the repository root README.

MIT

# dialectr-adapter-lomkit

Compile a dialectr query into a Laravel Lomkit `{ search }` payload, including nested includes and aggregates.

```ts
import { query } from 'dialectr'
import { toLomkit } from 'dialectr-adapter-lomkit'

toLomkit(query().where('age', '>=', 18).sort('name').build())
```

`search(text)` is sent as `search.text = { value }`. `extend('lomkit', { scopes, instructions, gates })` is merged into the search; any other key throws, and extensions for other targets are ignored.

`like` without a wildcard is sent as `%value%` (contains). Requires `dialectr` as a peer dependency and Node.js 18 or later. See the repository root README.

MIT

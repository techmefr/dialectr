# dialectr

Universal, dependency-free query builder. Describe a query once, compile it for any backend with an adapter.

```ts
import { query } from 'dialectr'

const built = query<{ name: string; age: number }>().where('age', '>=', 18).sort('name').limit(20).build()
```

Also exported: `escapeLike`, `parseLike`, `containsPattern`, `assertQuery`, `groupByOr`, and the bounds `MAX_DEPTH`, `MAX_NODES`, `MAX_LIST`, `MAX_LIMIT`.

Requires Node.js 18 or later. See the repository root README for operators, validation, limits and `like` semantics.

MIT

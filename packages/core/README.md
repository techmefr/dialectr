# dialectr

One query, every backend dialect. Zero-dependency query builder that compiles to lomkit, Strapi, PocketBase and more.

```ts
import { query } from 'dialectr'

const built = query<{ name: string; age: number }>().where('age', '>=', 18).sort('name').limit(20).build()
```

Also available: `search(text)` for free text, `extend(target, value)` for backend-specific options (target = adapter name, ignored by other adapters), and `to(compiler)` with `Compiler<TOutput> = (query: Query) => TOutput`.

Also exported: `escapeLike`, `parseLike`, `containsPattern`, `assertQuery`, `groupByOr`, and the bounds `MAX_DEPTH`, `MAX_NODES`, `MAX_LIST`, `MAX_LIMIT`, `MAX_SEARCH_LENGTH`.

Requires Node.js 18 or later. See the repository root README for operators, validation, limits and `like` semantics.

MIT

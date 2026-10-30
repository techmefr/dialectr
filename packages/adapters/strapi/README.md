# dialectr-adapter-strapi

Compile a dialectr query into Strapi v5 `filters`, `sort`, `fields`, `populate` and `pagination`.

```ts
import { query } from 'dialectr'
import { toStrapi } from 'dialectr-adapter-strapi'

toStrapi(query().where('age', '>=', 18).sort('name').build())
```

Aggregates and inner `like` wildcards (`a%b`, `a_b`) throw. Field names must be dot-separated identifiers and cannot start a segment with `$`. Requires `dialectr` as a peer dependency and Node.js 18 or later. See the repository root README.

`search(text)` and `extend('strapi', ...)` throw, as Strapi has no equivalent. Extensions for other targets are ignored.

MIT
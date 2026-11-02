---
title: Validation and limits
description: Snapshot, validation and the exported MAX constants.
---

`build()` returns a validated deep copy. Each adapter validates again with `prepareQuery`, so a hand-made `Query` gets the same checks, and changing a value after passing it in changes nothing.

```ts
import { assertQuery, query } from 'dialectr'

const built = query().where('a', 1).build()
const copy = assertQuery(built)
```

`assertQuery` and `prepareQuery` return the validated copy and throw on an unknown operator or connector, a bad sort direction, an empty group, a sparse array, a value that is not a string, finite number, boolean, `null`, `undefined` or valid `Date`, or a forbidden key (`__proto__`, `constructor`, `prototype`).

| Constant | Value | Applies to |
|---|---|---|
| `MAX_NODES` | 1000 | Shared budget: filters, sorts, selects, includes, aggregates, `in` list items, extension entries |
| `MAX_DEPTH` | 32 | Nested groups, includes, extension values |
| `MAX_LIST` | 10000 | Items in one `in` list |
| `MAX_LIMIT` | 10000 | `limit()` |
| `MAX_PAGE` | 1000000 | `page()` |
| `MAX_FIELD_LENGTH` | 256 | Field, relation and extension target names |
| `MAX_VALUE_LENGTH` | 4096 | Strings and `like` patterns |
| `MAX_SEARCH_LENGTH` | 1024 | `search()` text |
| `MAX_EXTENSION_KEYS` | 32 | Extension targets per query |

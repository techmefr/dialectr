# dialectr-adapter-lomkit

`toLomkit(query)` compiles a validated dialectr `Query` into `{ search }`. No runtime dependency besides the `dialectr` peer.

## Compilation rules

- `in []` becomes `value: [null]`, `not in []` is removed through `pruneAlwaysTrue` (core). Inside an `or` cluster the cluster, then the whole expression or enclosing group, becomes true and its filters vanish.
- `Date` becomes `YYYY-MM-DD HH:mm:ss` in UTC. Do not emit ISO strings: SQLite compares them as text.
- Aggregates keep Lomkit's default key `relation_type[_field]` for the first occurrence and get `alias` `..._2`, `..._3` for later ones with the same type, relation and field. An explicit `alias` is passed through and never reused by a generated one.
- `like` without wildcard is sent as `%value%`.

## Backend constraints to remember

- Text search (`search.text`) goes through Scout: not combinable with filters, sorts or scopes. Do not try to validate this in the adapter beyond documenting it.
- Resource `limits()` restricts `limit`; default 50 rows without `limit`.
- `max_nesting_depth` is 1 by default: deeper nesting answers 422.
- Delete of an unknown id answers 422.
- `escapeLike` is correct on MySQL and PostgreSQL only; SQLite treats `\` as a literal.

## Working here

- No comments in the code. Every behaviour change needs a unit test in `test/`.
- `pnpm build`, `pnpm test` and `pnpm -r exec tsc --noEmit` from the repository root must pass.
- Real-backend tests live in `ecosystem-playground/real/lomkit` and need Docker.

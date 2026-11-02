# AGENT.md — dialectr

## Role
Zero-dependency query builder (`packages/core`) and adapters compiling a validated `Query` to Lomkit, PocketBase and Strapi (`packages/adapters/*`). Docs site in `docs/`.

## Builder is immutable
Every `QueryBuilder` method returns a new builder. A callback given to `whereGroup`, `orWhereGroup`, `include` or the `where` option of `aggregate` receives a fresh builder and must return the chained result:

```ts
query().whereGroup(group => group.where('a', '=', 1).where('b', '=', 2))
```

Calling `group.where(...)` and returning `group` used to drop the group silently. `runCallback` in `packages/core/src/builder.ts` now throws an error ("chain the builder and return the result: builders are immutable") when the callback returns `undefined` or the very builder it received. An empty group built from another builder (`() => query()`) is still skipped. Tests: `packages/core/test/builder.test.ts`. Keep the check when adding a callback-taking method.

## Conditional filters

`whereIf` / `orWhereIf` skip `undefined`, `null`, `''` and `[]` (never `0` or `false`) and leave `where(field, 'in', [])` as is ("matches nothing"). `when(condition, cb)` goes through `runCallback`, so the immutability check applies. Tests: `packages/core/test/conditional.test.ts`.

## Extensions are typed through `ExtensionMap`

Core exports an empty `ExtensionMap` interface; an adapter augments it (`declare module 'dialectr'`) so `extend('lomkit', value)` is checked. Other targets stay `unknown`.

## Build/test
`pnpm build` · `pnpm test` · `pnpm -r exec tsc --noEmit`. Docs: `docs/` (`pnpm build` inside it). English, short, no comments in code.

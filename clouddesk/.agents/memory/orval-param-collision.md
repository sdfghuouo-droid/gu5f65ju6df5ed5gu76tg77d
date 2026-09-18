---
name: Orval nested-route param collision
description: TS2308 duplicate export when an operation has both path params AND query params in the same endpoint.
---

When an Orval-generated route has both a path parameter (e.g. `{id}`) and query parameters, Orval emits:
- `<OperationPascal>Params` TypeScript type in `generated/types/<op>Params.ts` (for query params)
- `<OperationPascal>Params` Zod schema in `generated/api.ts` (for path params)

Both get re-exported from `lib/api-zod/src/index.ts`, causing:
```
error TS2308: Module "./generated/api" has already exported a member named 'ListCommandsParams'
```

**Why:** Orval names the path-param Zod schema `<Op>Params` and also auto-generates a TS type with the same name for query params on nested routes.

**How to apply:** For nested routes like `GET /clients/{id}/commands?limit=50`, remove the query param from the spec and handle it server-side with a default. Routes with ONLY path params or ONLY query params don't collide.

# src/db/client.ts

Initializes and exports the Drizzle ORM database client backed by Expo SQLite.

## What it does

- Opens (or creates) the on-device SQLite database file `teamtimer.db` with change-listener support, allowing reactive queries.
- Wraps it with Drizzle using the full schema so all tables are type-safe and queryable through the `db` export.

## Exports

### `db`

The Drizzle database instance. Use this in repositories and anywhere a database query is needed.

```typescript
import { db } from '@/db/client';

const rows = await db.select().from(schema.athletes);
```

### `DB`

TypeScript type alias for `typeof db`. Useful when passing the db instance as a parameter.

```typescript
import type { DB } from '@/db/client';

function myQuery(database: DB) { ... }
```

## Notes

- `enableChangeListener: true` is required for Drizzle's live/reactive query hooks to fire on updates.
- The file should be imported lazily or after migrations have run (see `src/db/migrate.ts`).

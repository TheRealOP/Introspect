# ⚡ tRPC 11 API Layer & Procedure Pipeline

This article details the type-safe API communication layer powered by **tRPC 11**, the server router configurations, the query clients, and our custom development middleware.

---

## 🔗 Type-Safe Endpoints Without Code-Gen

tRPC allows us to share TypeScript types directly between the backend API implementation and the frontend client components.
* When we declare query and mutation procedures in the backend, TypeScript automatically infers the input Zod validation models and the return data models.
* The frontend simply imports the `AppRouter` type signature. **No REST code generation or OpenAPI specs are needed** — modifying a backend type instantly reflects as compile-time typesafety inside the React component!

---

## 🛠️ The Server Initialization (`src/server/api/trpc.ts`)

The entire tRPC layer is initialized inside `trpc.ts` where we establish context, register error formatting, and declare procedure factories.

### 1. Request Context
The context object is generated for every incoming request. It makes resources like the Drizzle database client available to our backend procedure functions:
```typescript
export const createTRPCContext = async (opts: { headers: Headers }) => {
  return {
    db,
    ...opts,
  };
};
```

### 2. tRPC Instance
The tRPC server is initialized with:
* `superjson` transformer to maintain JavaScript object types (e.g. `Date` objects remain `Date` objects on the client instead of stringifying).
* Custom `errorFormatter` which maps validation failures back to Zod schema keys so the React forms can display precise field errors.
```typescript
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});
```

---

## ⏱️ Latency Middleware (Waterfall Prevention)

To enforce excellent loading state UX and catch network serialization bugs during local prototyping, we inject a custom `timingMiddleware` in our procedural pipeline:

```typescript
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    // Artificial random latency between 100ms and 500ms
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();
  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});
```

> [!WARNING]
> This middleware runs on **every procedure execution**. In local development, it mimics real-world mobile internet speeds, forcing you to design excellent React `<Suspense>` boundaries and skeleton loading layouts immediately, rather than discovering loading bugs after deployment!

---

## 🗂️ Routers Assembly & Procedures

Our API procedures are split across modular router files inside `src/server/api/routers/` and registered inside the global `appRouter` in `src/server/api/root.ts`.

### Current `appRouter` registration (`src/server/api/root.ts`)
```typescript
export const appRouter = createTRPCRouter({
  post: postRouter,     // placeholder stub
  journal: journalRouter, // Phase 2 ✓ — activity check-in CRUD
});
```

---

### Phase 2 — Journal Router (`src/server/api/routers/journal.ts`)

The live router powering the activity check-in feature. Uses `ctx.db` (injected by `createTRPCContext`) and `uuid` for primary key generation.

```typescript
import { desc } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { entries } from "~/server/db/schema";

export const journalRouter = createTRPCRouter({
  // Inserts a new check-in entry. UUIDv4 generated server-side.
  create: publicProcedure
    .input(z.object({ content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const id = uuid();
      await ctx.db.insert(entries).values({ id, content: input.content });
      return { id };
    }),

  // Returns all entries ordered newest-first.
  list: publicProcedure.query(({ ctx }) => {
    return ctx.db.select().from(entries).orderBy(desc(entries.createdAt));
  }),
});
```

**Client usage pattern** in `src/app/_components/journal.tsx`:
```typescript
import { api } from "~/trpc/react";

const utils = api.useUtils();
const { data: entries } = api.journal.list.useQuery();
const create = api.journal.create.useMutation({
  onSuccess: async () => {
    await utils.journal.list.invalidate(); // refetch list after save
    setContent("");
  },
});
```

---

### Placeholder Router (`src/server/api/routers/post.ts`)
Procedures use `publicProcedure` which automatically inherits the database context and the timing middleware:
```typescript
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const postRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input, ctx }) => {
      return {
        greeting: `Hello ${input.text}`, // ctx.db is fully available here
      };
    }),
});
```

---

## 🌐 The Client Bridges

Introspect connects components to the backend in two ways depending on the React rendering environment:

### 1. Client Components (`src/trpc/react.tsx`)
For client-rendered trees (`"use client"`), we wrap the application in a React Query provider. This exposes the `api` hook generator:
```typescript
"use client";
import { createTRPCReact } from "@trpc/react-query";
export const api = createTRPCReact<AppRouter>();
```
* **Query Configuration (`src/trpc/query-client.ts`)**: Sets up a unified cache. We default to a `staleTime` of 30 seconds to prevent unnecessary double-fetching when elements mount and unmount rapidly.

### 2. React Server Components (RSC) (`src/trpc/server.ts`)
Because React Server Components execute directly on the server, they do not need to make HTTP loopback requests. Instead, `src/trpc/server.ts` generates a **server caller** which invokes the procedure functions directly in-process:
```typescript
import { createCaller } from "~/server/api/root";
export const api = createCaller(createTRPCContext);
```
* **RSC Usage**:
  ```typescript
  // src/app/page.tsx
  import { api } from "~/trpc/server";

  export default async function Page() {
    const data = await api.post.hello({ text: "from RSC" });
    return <div>{data.greeting}</div>;
  }
  ```

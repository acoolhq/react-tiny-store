# @acoolhq/react-tiny-store

**react-tiny-store** is a tiny, selector-first state layer for React built on `useSyncExternalStore`.  
It gives you **granular subscriptions**, **SSR-safe hydration**, and **no boilerplate reducers**.

- ✨ Selector-driven updates (`useStoreSelector`, or `createContextSync().useSelector`)
- 🧠 Stable equality via `Object.is` (overrideable per selector)
- 🧩 Works great as **local-but-shareable** state (not another monolith)
- 🧪 Tiny and testable

```bash
npm i @acoolhq/react-tiny-store
# or
pnpm add @acoolhq/react-tiny-store
```

- **Start here:** [Getting Started](./getting-started.md)  
- **Dive deeper:** [Concepts](./guides/concepts.md) · [SSR & Hydration](./guides/ssr-hydration.md) · [Batching Updates](./guides/batching.md) · [Performance Patterns](./guides/perf-patterns.md)  
- **API:** [Reference](./api/) · [Examples](./examples.md)  
- **Live Bench:** [Benchmarks](./benchmarks.md)

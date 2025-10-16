# Benchmarks

Test-drive real rendering behavior in the companion app:  
**Live bench → <https://acoolhq.github.io/rts-bench/>**

- **RTS (store + selector)** — baseline `makeStore` + `useStoreSelector`.
- **RTS + Batching** — same store, but updates wrapped in [`batch`](./guides/batching.md) to coalesce bursts triggered by controllers.
- **RTS + Context (createContextSync)** — provider + selectors built from the library.
- **Context + useState** — naïve context that re-renders every leaf on any change.
- **Context + useReducer** — similar baseline using a reducer.

All variants end up with the same final selector value—React will bail if nothing changed—but wall time diverges because every store update still emits a notification. The batching row shows how collapsing those notify → read → compare cycles into one pass keeps the UI just as stable while spending far less time doing redundant work.

Scenarios you can trigger in the bench:

- **Unrelated updates** — change/hammer a field unrelated to the items multiple times
- **Single index updates** — repeatedly bump one `items[i]`.
- **Random churn** — touch random indices many times.

> Run the bench in production mode for realistic timings.

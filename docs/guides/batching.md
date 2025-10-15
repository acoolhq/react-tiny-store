# Batching updates

`batch(fn)` queues store notifications while the callback runs.  
Every call to `store.setState` / `store.replace` / `store.reset` still mutates the store's state synchronously—`store.getState()` inside the batch already sees the updated value. The only thing deferred is the notifier dispatch. Once the outermost batch completes we flush the notifier queue once, and because selectors subscribe through `useSyncExternalStore`, React components that read the store through `useSelector`, `useStoreSelector`, or slice hooks re-render exactly once.

```ts
import { batch, makeStore } from "@acoolhq/react-tiny-store";

const store = makeStore({ count: 0 });

store.subscribe(() => {
  console.log("render", store.getState().count);
});

batch(() => {
  store.setState((prev) => ({ count: prev.count + 1 }));
  store.setState((prev) => ({ count: prev.count + 1 }));
  console.log(store.getState().count); // 2 (state is current inside the batch)
}); // listener logs once: "render 2"
```

## How it works

1. `batch` increments an internal depth counter and runs your callback.  
2. While depth > 0, `setState` / `replace` / `reset` synchronously update the store state and enqueue the store's notifier instead of calling it.  
3. When the outermost batch exits, the queue is flushed (deduped `Set`); each notifier calls the subscribers registered by `useSyncExternalStore`.  
4. React sees the notifier fire and synchronously re-reads the snapshot, yielding exactly one render per store.

If a nested batch throws, the finally block still decrements depth, so the queue flushes (or remains queued for the parent) before the error re-throws.

## When to batch

Use `batch` only for niche situations where multiple store mutations would otherwise trigger back-to-back selector renders. Typical cases:

- Controllers or async flows that call `setState` / `replace` / `reset` more than once while updating UI driven by `useSelector`/`useStoreSelector` (slice hooks are built on the same selector subscription).  
- Coordinating updates across several stores so the UI never sees intermediate values.

Plain `store.getState()` reads do not subscribe to changes, so they won't cause renders regardless of batching.

> Use `batch` only for this store's updates. React already batches its own `useState` / `useReducer` writes inside event handlers; reach for `batch` when you're grouping *store* updates triggered from async flows, external listeners, or anywhere React's built-in batching doesn't apply.

# Batching

`batch(fn)` is the store’s optional notifier buffer. Call it when a controller fires several back-to-back `setState` / `replace` / `reset` calls and you want subscribers to react once with the final state instead of after every intermediate update. State still mutates synchronously; batching simply defers the subscriber notification pass.

## How it works

1. Entering `batch` increments an internal depth counter.
2. While depth > 0, updates mutate the store immediately but queue the store’s notifier instead of firing it. A `Set` dedupes multiple enqueues.
3. When the outermost batch exits, the queue flushes exactly once. Subscribers run a single notification pass no matter how many updates happened inside.
4. React receives that lone notification and re-checks selector values. Its own render batching rules still apply—`batch` just prevents the store from pinging subscribers hundreds of times.

## How this differs from React’s batching

- React already collapses renders: if a selector yields new values mid-event, React still commits once with the final value.
- The cost is in notifications: every `store.setState` triggers a notify → snapshot read → compare loop. Without batching, you pay that loop for each update, even though React only renders once.
- Batching cuts the loop count: mutations still run synchronously, but subscribers are notified once at the end. That’s where the wall-time win comes from—fewer notification cycles, not different render semantics.
- Internal vs external: `useState`/`useReducer` updates invoked in React events are auto-batched by React. External stores notify React from the outside, so nothing coalesces them for you unless you use `batch`.

## When to use it

- Normal app flows: call `setState` directly; batching is overkill.
- Multi-update bursts: wrap them in `batch` so controllers (optimistic updates, cross-slice coordination, benchmark loops) trigger one subscriber pass instead of many.
- Keep React’s own `useState` / `useReducer` calls outside `batch`; React already batches those internally.
- Plain `store.getState()` reads aren’t subscriptions, so batching has no effect on them.

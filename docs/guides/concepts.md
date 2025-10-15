# Concepts

## Selector-first subscriptions
`useSyncExternalStore` (uSES) lets you subscribe to an external store and **select** exactly what your component needs:

```tsx
const value = useStoreSelector(store, s => s.items[i].value);
```

Only this component re-renders when `items[i].value` changes.

> For UI components, always read state through `useSelector` / `useStoreSelector` (or slice hooks built on them). `store.getState()` is synchronous but **does not subscribe**, so using it inside render will freeze the value and miss updates. Reserve `getState()` for controllers (via `useActions` / `bindActions`) or utility code that needs an immediate snapshot outside of React rendering.
> Controller factories receive `api.set`, `api.replace`, and `api.reset`, so they can orchestrate updates, full-state swaps, or return to the captured initial state without leaking into UI code.

---

## Equality
By default, selectors use `Object.is(prev, next)`. You can provide a custom comparator:

```tsx
const x = useStoreSelector(store, s => derive(s), (a, b) => shallowEqual(a, b));
```

Prefer deriving **cheap, immutable** values. Avoid deep equals on huge objects.

---

## Context vs store-only
- **Store-only** (`makeStore + useStoreSelector`) is perfect for isolated modules and *feature-local* state that can be shared.
- **Context** (`createContextSync`) gives ergonomic app-level `Provider` + `useSelector` + `bindActions`.

---

## Pure slice helpers
Use `Tiny.createSlice(select, fns)` if you want reusable, pure updaters bound to the root;  
or build actions with `Tiny.bindActions(api => ({ ... }))` for side-effects and composition. Slice actions and `api.set` must return the next state synchronously—think `useReducer`, just without boilerplate.

### Calling slices from controllers

Slice hooks can be consumed inside controller factories so both pieces share the same store instance:

```ts
const useTodos = Tiny.createSlice(s => s.todos, {
  add(root, todo: Todo) {
    return { ...root, todos: [todo, ...root.todos] };
  },
  confirm(root, id: string, real: Todo) {
    return {
      ...root,
      todos: root.todos.map(t => (t.id === id ? { ...real, optimistic: false } : t)),
    };
  },
});

const useTodosActions = Tiny.bindActions((_api) => {
  const { actions: todos } = useTodos(); // safe: slice uses the same context store
  return {
    async addAndPersist(text: string) {
      const temp = { id: `tmp-${Date.now()}`, text, optimistic: true };
      todos.add(temp); // optimistic update (pure slice action)
      try {
        const res = await fetch("/api/todos", { method: "POST", body: JSON.stringify({ text }) });
        const real = await res.json();
        todos.confirm(temp.id, real);
      } catch {
        // failures can still use slice helpers
        todos.confirm(temp.id, { ...temp, optimistic: false });
      }
    },
  };
});
```

This pattern keeps pure updates in slices while controllers handle side-effects. Slice actions remain pure and synchronous; controllers orchestrate async work without re-implementing state transitions.

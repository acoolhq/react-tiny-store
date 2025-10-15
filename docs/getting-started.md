# Getting Started

This guide shows the two primary ways to use **react-tiny-store**:
1) a minimal **external store**, and  
2) a convenient **Context wrapper** for app-wide usage.

---

## 1) Minimal external store

```tsx
import { makeStore, useStoreSelector, type Store } from '@acoolhq/react-tiny-store';

type TodosState = { tick: number; todos: { id: string; text: string }[] };

const store: Store<TodosState> = makeStore({ tick: 0, todos: [] });

// Read a slice (granular subscription)
function TodoCount() {
  const count = useStoreSelector(store, s => s.todos.length);
  return <span>{count}</span>;
}

// ❌ Avoid calling store.getState() inside render; it won't subscribe.
// Controllers (useActions/bindActions) can call api.get() safely outside render.

// Update (always return new objects—state is treated as immutable)
function AddTodoButton() {
  return (
    <button
      onClick={() =>
        store.setState(p => ({
          ...p,
          todos: [...p.todos, { id: crypto.randomUUID(), text: 'New' }]
        }))
      }
    >
      Add
    </button>
  );
}
```

**Why selectors?** Only components that read a value will re-render when that value changes.  
Updating `tick` won’t re-render a component that only selects `todos`, and vice-versa.

> **Immutable updates only:** `store.setState` and `store.replace` expect you to return **new** objects/primitives. Mutating the existing state object will leak changes into `getInitialState()` and make `reset()` unusable. Clone first, then return the new value.

> **Reset when needed:** `makeStore` creates a singleton store. If you re-use that store across screens, call `store.reset()` on teardown to avoid stale data:
> ```tsx
> useEffect(() => () => store.reset(), []);
> ```

---

## 2) Context + hooks (app-wide convenience)

```tsx
import { createContextSync } from '@acoolhq/react-tiny-store';

type AppState = { tick: number; todos: { id: string; text: string }[] };
const Tiny = createContextSync<AppState>();

export function App() {
  return (
    <Tiny.Provider initial={{ tick: 0, todos: [] }}>
      <Toolbar />
      <TodoList />
    </Tiny.Provider>
  );
}

function Toolbar() {
  const tick = Tiny.useSelector(s => s.tick);

  const actions = Tiny.bindActions(api => ({
    inc() { api.set(p => ({ ...p, tick: p.tick + 1 })); }
  }))();

  return <button onClick={actions.inc}>tick: {tick}</button>;
}

function TodoList() {
  const todos = Tiny.useSelector(s => s.todos);
  return <ul>{todos.map(t => <li key={t.id}>{t.text}</li>)}</ul>;
}

// When this component unmounts we still keep the store alive (context-owned).
```

---

## Next steps
- Understand the model: [Concepts](./guides/concepts.md)  
- Hydrate on SSR: [SSR & Hydration](./guides/ssr-hydration.md)  
- Tune performance: [Performance Patterns](./guides/perf-patterns.md)  
- Explore the API: [Reference](./api/)

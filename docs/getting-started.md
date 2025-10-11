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

// Update
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
```

---

## Next steps
- Understand the model: [Concepts](./guides/concepts.md)  
- Hydrate on SSR: [SSR & Hydration](./guides/ssr-hydration.md)  
- Tune performance: [Performance Patterns](./guides/perf-patterns.md)  
- Explore the API: [Reference](./api/)

# API Examples

Quick, copy-pastable snippets for every export in `@acoolhq/react-tiny-store`.  
For deeper discussion, see the [Guides](./guides/concepts.md) and the generated [API reference](./api/).

## `makeStore`

Create a standalone external store and use selector hooks against it.

```tsx
import { makeStore, useStoreSelector } from "@acoolhq/react-tiny-store";

type CounterState = { count: number };
const store = makeStore<CounterState>({ count: 0 });

// ✅ The store expects immutable updates — always return new objects or primitives.
export function CounterValue() {
  const count = useStoreSelector(store, (s) => s.count);
  return <span>Count: {count}</span>;
}

export function IncrementButton() {
  return (
    <button onClick={() => store.setState((prev) => ({ count: prev.count + 1 }))}>
      Increment
    </button>
  );
}

// Optional teardown if the store should reset on unmount:
// React.useEffect(() => () => store.reset(), []);
```

## `useStoreSelector`

Subscribe to any `Store<T>` instance and derive exactly what a component needs.

```tsx
import type { Store } from "@acoolhq/react-tiny-store";
import { useStoreSelector } from "@acoolhq/react-tiny-store";

type AppState = { todos: { id: string; completed: boolean }[] };

function TodoCount({ store }: { store: Store<AppState> }) {
  const openTodos = useStoreSelector(store, (s) =>
    s.todos.filter((t) => !t.completed).length
  );
  return <span>Open: {openTodos}</span>;
}
```

Optionally pass an equality function:

```tsx
const todoIds = useStoreSelector(
  store,
  (s) => s.todos.map((t) => t.id),
  (a, b) => a.length === b.length && a.every((id, i) => id === b[i])
);
```

## `createStoreSlice`

Build reusable, pure updaters plus a selector for a portion of the store.

```tsx
import { createStoreSlice, makeStore } from "@acoolhq/react-tiny-store";

type Todo = { id: string; text: string };
type RootState = { todos: Todo[] };

const store = makeStore<RootState>({ todos: [] });

const useTodos = createStoreSlice(store, (root) => root.todos, {
  add(root, todo: Todo) {
    return { ...root, todos: [todo, ...root.todos] };
  },
  remove(root, id: string) {
    return { ...root, todos: root.todos.filter((t) => t.id !== id) };
  },
});

function TodoList() {
  const { state: todos, actions } = useTodos();
  return (
    <ul>
      {todos.map((t) => (
        <li key={t.id}>
          {t.text}
          <button onClick={() => actions.remove(t.id)}>Remove</button>
        </li>
      ))}
    </ul>
  );
}
```

## `useStoreActions`

Create side-effect-capable controllers against a store.

```tsx
import type { Store } from "@acoolhq/react-tiny-store";
import { useStoreActions } from "@acoolhq/react-tiny-store";

type AppState = { todos: { id: string; text: string; optimistic?: boolean }[] };

const useTodosController = (store: Store<AppState>) =>
  useStoreActions(
    store,
    (api) => ({
      async addAndPersist(text: string) {
        const temp = { id: crypto.randomUUID(), text, optimistic: true };
        api.set((prev) => ({ ...prev, todos: [temp, ...prev.todos] }));
        try {
          const res = await fetch("/api/todos", {
            method: "POST",
            body: JSON.stringify({ text }),
          });
          const real = await res.json();
          api.set((prev) => ({
            ...prev,
            todos: prev.todos.map((t) => (t.id === temp.id ? real : t)),
          }));
        } catch {
          api.set((prev) => ({
            ...prev,
            todos: prev.todos.filter((t) => t.id !== temp.id),
          }));
        }
      },
    }),
    []
  );
```

## `bindStoreActions`

Pre-bind a controller factory to a store and expose it as a hook.

```tsx
import { bindStoreActions, makeStore } from "@acoolhq/react-tiny-store";

const store = makeStore({ todos: [] as string[] });

const useTodosActions = bindStoreActions(store, (api) => ({
  clear() {
    api.reset();
  },
}));

function ClearButton() {
  const { clear } = useTodosActions();
  return <button onClick={clear}>Clear todos</button>;
}
```

## `createContextSync`

Generate a typed provider plus hooks for app-wide usage.

```tsx
import { createContextSync } from "@acoolhq/react-tiny-store";

type Todo = { id: string; text: string; optimistic?: boolean };
type AppState = { todos: Todo[]; lastUpdated: number };

const TodosContext = createContextSync<AppState>();
const { Provider, useSelector, bindActions, createSlice } = TodosContext;

const useTodos = createSlice((root) => root.todos, {
  add(root, todo: Todo) {
    return { ...root, todos: [todo, ...root.todos] };
  },
});

const useTodosActions = bindActions((api) => {
  const { actions: todos } = useTodos();
  return {
    add(text: string) {
      todos.add({ id: crypto.randomUUID(), text });
      api.set((prev) => ({ ...prev, lastUpdated: Date.now() }));
    },
  };
});

export function App() {
  return (
    <Provider initial={{ todos: [], lastUpdated: 0 }}>
      <TodosScreen />
    </Provider>
  );
}
```

## `batch`

Group store updates so selector-driven components render once.

```tsx
import { batch, makeStore } from "@acoolhq/react-tiny-store";

type ItemsState = { loading: boolean; items: string[] };
const store = makeStore<ItemsState>({ loading: false, items: [] });

batch(() => {
  store.setState((prev) => ({ ...prev, loading: true }));
  const resultFromFetch = ["a", "b", "c"];
  store.setState((prev) => ({ ...prev, items: resultFromFetch }));
  store.setState((prev) => ({ ...prev, loading: false }));
});
```

Nested batches coalesce automatically:

```tsx
batch(() => {
  store.setState(...);
  batch(() => {
    store.setState(...);
    store.replace(...);
  });
});
```

## `StoreAccess` (type)

Controller factories receive a `StoreAccess<T>` object—handy when typing custom helpers.

```ts
import type { StoreAccess } from "@acoolhq/react-tiny-store";

type AppState = { todos: { id: string; completed: boolean }[] };

type TodosApi = StoreAccess<AppState>;

function markAllComplete(api: TodosApi) {
  api.set((prev) => ({
    ...prev,
    todos: prev.todos.map((t) => ({ ...t, completed: true })),
  }));
}
```

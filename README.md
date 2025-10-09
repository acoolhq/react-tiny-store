# @acoolhq/react-tiny-store

Tiny, reducer-less React state built on `useSyncExternalStore`.

- **Hydration-safe** selectors
- **No reducers required** — write pure updaters or do effects in controllers
- **Three primitives via a factory**: `Provider`, `useSelector`, `useActions` / `bindActions`, `createSlice`

![Build & Test](https://github.com/acoolhq/react-tiny-store/actions/workflows/ci.yml/badge.svg?branch=main)
![TypeScript](https://github.com/acoolhq/react-tiny-store/actions/workflows/types.yml/badge.svg?branch=main)

---

## Install

```bash
npm i @acoolhq/react-tiny-store
# peer deps
npm i react react-dom
```

---

## Quick start

### 1) Create a typed store

```tsx
// appStore.ts
import { createContextSync } from "@acoolhq/react-tiny-store";

export type Todo = { id: string; text: string; optimistic?: boolean };
export type AppState = { todos: Todo[]; ui: { modalOpen: boolean } };

export const {
  Provider: AppProvider,
  useSelector,
  useActions,
  bindActions,
  createSlice,
} = createContextSync<AppState>();
```

### 2) Provide initial state (SSR-friendly)

```tsx
// app root (e.g., _app.tsx / layout.tsx)
import { AppProvider } from "../appStore";

const initial: AppState = { todos: [], ui: { modalOpen: false } };

export default function Root() {
  return (
    <AppProvider initial={initial}>
      <App />
    </AppProvider>
  );
}
```

### 3) Make a slice (pure root updaters)

```ts
// features/todos/useTodos.ts
"use client";
import { createSlice } from "../appStore";
import type { AppState } from "../appStore";
type Todo = AppState["todos"][number];

export const useTodos = createSlice(
  (root) => root.todos, // what this hook reads
  {
    add(root, todo: Todo) {
      return { ...root, todos: [todo, ...root.todos] };
    },
    remove(root, id: string) {
      return { ...root, todos: root.todos.filter((t) => t.id !== id) };
    },
    replaceAll(root, next: Todo[]) {
      return { ...root, todos: next };
    },
  }
);
```

### 4) Optional: controllers with side-effects

```ts
// features/todos/useTodosActions.ts
"use client";
import { bindActions } from "../appStore";
import { useTodos } from "./useTodos";

export const useTodosActions = bindActions((_api) => {
  const { actions: todos } = useTodos(); // ✅ calling hooks inside

  return {
    async addAndPersist(text: string) {
      const tmp = { id: `tmp-${Date.now()}`, text, optimistic: true };
      todos.add(tmp); // optimistic
      try {
        const res = await fetch("/api/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error("create failed");
        const real = await res.json();
        // add a confirm updater or refetch and replaceAll
      } catch {
        todos.remove(tmp.id);
      }
    },
  };
});
```

### 5) Use in components

```tsx
"use client";
import { useTodos } from "../features/todos/useTodos";
import { useTodosActions } from "../features/todos/useTodosActions";

export function TodoList() {
  const { state: todos, actions } = useTodos();
  const { addAndPersist } = useTodosActions();

  return (
    <>
      <button onClick={() => addAndPersist("New task")}>Add</button>
      <ul>
        {todos.map((t) => (
          <li key={t.id}>
            {t.text} <button onClick={() => actions.remove(t.id)}>x</button>
          </li>
        ))}
      </ul>
    </>
  );
}
```

---

## API

### `createContextSync<T>() → { Provider, useSelector, useActions, bindActions, createSlice }`

- **`Provider({ initial: T, children })`**  
  Creates the store and freezes the first server snapshot for hydration. Mount once at your app root.

- **`useSelector(select, isEqual?) → S`**  
  Hydration-safe selector using `useSyncExternalStore`. Re-renders only when `select(state)` changes (by `Object.is`, or your `isEqual`).

- **`useActions(factory, deps?) → A`**  
  Build controllers that can perform side-effects. The factory runs inside a hook, so you can call other hooks (including your slice hooks). Return any object of functions. Use `deps` if you want stable identities tied to inputs.

- **`bindActions(factory) → (deps?) => A`**  
  Sugar to export a controller as a one-liner hook.

- **`createSlice(select, pureFns) → useSlice()`**  
  `pureFns` are **pure root updaters**: `(root, ...args) => newRoot` (no side-effects).  
  `useSlice()` returns `{ state, get, actions }`:
  - `state`: current selected value (subscribed)
  - `get()`: read latest selected value synchronously
  - `actions`: bound versions of your `pureFns` (they call `setState(prev => fn(prev, ...))`)

> Side-effects go in controllers (`useActions` / `bindActions`), not in slice pure functions.

---

## Patterns & tips

- **SSR/Hydration:** Pass the same `initial` on server and client. Reads are hydration-safe via `useSyncExternalStore`.
- **Reset on unmount:** Add a pure `clear` updater in your slice and call it in a cleanup:
  ```tsx
  const { actions } = useTodos();
  React.useEffect(() => () => actions.clear(), []);
  ```
- **Tree-shaking:** Put each slice/controller in its own module and import only what you use. No global registry.
- **Stability:** Keep controller deps small; prefer passing changing values as function arguments to avoid unnecessary re-creations.

---

## Why this (vs reducers/store libs)?

- You keep React mental model: selectors + hooks.
- Pure functions for state transitions; effects separated cleanly.
- No reducers, actions, or middleware boilerplate. Tiny surface area.

---

## License

MIT

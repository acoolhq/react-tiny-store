# Concepts

## Selector-first subscriptions
`useSyncExternalStore` (uSES) lets you subscribe to an external store and **select** exactly what your component needs:

```tsx
const value = useStoreSelector(store, s => s.items[i].value);
```

Only this component re-renders when `items[i].value` changes.

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
or build actions with `Tiny.bindActions(api => ({ ... }))` for side-effects and composition.

# Performance Patterns

## 1) Keep selectors fine-grained
Prefer `s => s.items[i].value` over selecting a large object. Smaller selections → fewer renders.

```ts
const value = useStoreSelector(store, s => s.items[i].value);
```

---

## 2) Structural sharing
When updating arrays/objects, clone only the changed layer.

```ts
store.setState(p => {
  const items = p.items.slice();
  items[i] = { ...items[i], value: items[i].value + 1 };
  return { ...p, items };
});
```

---

## 3) Avoid expensive equals
Default `Object.is` is fast. If you pass a custom equality, keep it cheap and shallow.

---

## 4) Measure
Use React Profiler in **production** build.  
You can also count re-renders with a `useEffect` bump while benchmarking.

---

## 5) When to reach for something bigger
If you need cross-app caching, middleware stacks, or normalized entity graphs, combine this library with a dedicated data layer.  
For many UI flows, selector-first local stores are faster & simpler.

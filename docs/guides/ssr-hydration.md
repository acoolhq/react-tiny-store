# SSR & Hydration

The goal: the server HTML and the client's initial render **match**.  
`createContextSync.Provider` takes an **initial** value and freezes the server snapshot for hydration.

---

## Next.js example

```tsx
// pages/_app.tsx
import { createContextSync } from '@acoolhq/react-tiny-store';
type AppState = { tick: number; todos: { id: string; text: string }[] };
const Tiny = createContextSync<AppState>();

export default function App({ Component, pageProps }) {
  return (
    <Tiny.Provider initial={pageProps.initialState}>
      <Component {...pageProps} />
    </Tiny.Provider>
  );
}
```

**Server**
```ts
// pages/index.tsx
export async function getServerSideProps() {
  const todos = await fetchTodos();
  return { props: { initialState: { tick: 0, todos } } };
}
```

**Client**
On the first client render, selectors read from the **server snapshot** so markup matches.  
From then on, they subscribe to the live store.

If you’re using `makeStore` directly, `useStoreSelector(store, sel)` uses `store.getInitialState()` for the server snapshot. Keep your `initial` value **stable** across the first render.

---

## Tips
- Avoid creating a **new object identity** for `initial` on every render. Memoize it or define it outside components.
- If you need to wholesale **replace** after hydration (client-only data), call `replace(next)` **after** the first effect.
- Ensure data fetched on the server that appears in markup is present in `initial`, or you’ll get hydration mismatches.

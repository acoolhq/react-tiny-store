# @acoolhq/react-tiny-store

Tiny, selector-first state for React built on `useSyncExternalStore`.

![Build & Test](https://github.com/acoolhq/react-tiny-store/actions/workflows/ci.yml/badge.svg?branch=main)
![TypeScript](https://github.com/acoolhq/react-tiny-store/actions/workflows/types.yml/badge.svg?branch=main)

## Documentation

Full documentation (guides, API reference, examples) lives at **https://acoolhq.github.io/react-tiny-store/**.  
Head there for detailed quick-starts, slice patterns, and controller recipes.

## Install

```bash
npm i @acoolhq/react-tiny-store
# peer deps
npm i react react-dom
```

## Why this store?

- Selector-driven updates with `useSyncExternalStore` hydration safety.
- Pure slice helpers plus controller hooks for side-effects.
- Tiny surface area — no reducers, actions, or global registries.

## Minimal example

```tsx
import { createContextSync } from "@acoolhq/react-tiny-store";

type AppState = { count: number };

const { Provider, useSelector, bindActions } = createContextSync<AppState>();

const useCounter = bindActions((api) => ({
  inc() {
    api.set((prev) => ({ count: prev.count + 1 }));
  },
}));

function Counter() {
  const count = useSelector((s) => s.count);
  const { inc } = useCounter();
  return <button onClick={inc}>Clicked {count}</button>;
}

export function App() {
  return (
    <Provider initial={{ count: 0 }}>
      <Counter />
    </Provider>
  );
}
```

## Contributing

Issues and pull requests are welcome. Run `npm run test:run` before opening a PR.

## License

MIT

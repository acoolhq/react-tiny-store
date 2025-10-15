import React from "react";
import { type Store } from "./store";

/**
 * Narrow store access passed to action factories.
 * @typeParam T - State shape.
 */
export type StoreAccess<T> = {
  /** Read current state. */
  get: () => T;
  /** Set next state or updater. */
  set: Store<T>["setState"];
  /** Replace entire state. */
  replace: Store<T>["replace"];
  /** Reset to the initial state captured at construction. */
  reset: Store<T>["reset"];
};

/* =============================================================================
   Store-param React helpers (no context required)
============================================================================= */

/**
 * Selects a derived value from a store with granular re-renders.
 *
 * @typeParam T - Root state shape.
 * @typeParam S - Selected slice shape.
 * @param store - The external store instance.
 * @param selector - Pure selector `(root) => slice`.
 * @param isEqual - Optional equality to suppress updates (default `Object.is`).
 * @returns The selected value `S`, updated only when `isEqual(prev, next)` is false.
 * @category Store
 *
 * @example
 * const count = useStoreSelector(store, s => s.todos.length);
 */
export function useStoreSelector<T, S>(
  store: Store<T>,
  selector: (root: T) => S,
  isEqual: (a: S, b: S) => boolean = Object.is
): S {
  const selRef = React.useRef(selector);
  const eqRef = React.useRef(isEqual);
  const last = React.useRef<S>(selector(store.getState()));

  // If selector or equality changes, re-seed baseline immediately
  if (selRef.current !== selector || eqRef.current !== isEqual) {
    selRef.current = selector;
    eqRef.current = isEqual;
    last.current = selector(store.getState());
  }

  const getSnap = React.useCallback(() => {
    const next = selRef.current(store.getState());
    const prev = last.current;
    if (eqRef.current(prev, next)) return prev;
    last.current = next;
    return next;
  }, [store]);

  const getServerSnap = React.useCallback(
    () => selRef.current(store.getInitialState()),
    [store]
  );

  const value = React.useSyncExternalStore(
    store.subscribe,
    getSnap,
    getServerSnap
  );
  React.useDebugValue(value);
  return value;
}

/**
 * Build **controller** actions for a store (side-effects/async allowed).
 * @typeParam T - Root state.
 * @typeParam A - Actions shape returned by the factory.
 * @param store - The external store.
 * @param factory - `(api) => actions` — may perform side-effects and use other hooks.
 * @param deps - Memo deps for the returned actions object.
 * @returns Actions `A` (controller actions).
 * @category Controllers
 *
 * @example
 * const actions = useStoreActions(store, api => ({
 *   add(text: string) {
 *     api.set(p => ({ ...p, todos: [...p.todos, { id: crypto.randomUUID(), text }] }));
 *   }
 * }), []);
 */
export function useStoreActions<T, A>(
  store: Store<T>,
  factory: (api: StoreAccess<T>) => A,
  deps: any[] = []
): A {
  const api = React.useMemo<StoreAccess<T>>(
    () => ({
      get: store.getState,
      set: store.setState,
      replace: store.replace,
      reset: store.reset,
    }),
    [store]
  );
  const built = factory(api); // allow hooks inside factory
  return React.useMemo(() => built, deps);
}

/**
 * Bind a **controller** factory to a store and get a hook that returns actions.
 * @typeParam T - Root state.
 * @typeParam A - Actions shape.
 * @param store - The external store.
 * @param factory - `(api) => actions` (controller actions).
 * @returns `(deps?) => A`
 * @category Controllers
 *
 * @example
 * const useTodos = bindStoreActions(store, api => ({
 *   clear() { api.set(p => ({ ...p, todos: [] })); }
 * }));
 *
 * function Toolbar() {
 *   const { clear } = useTodos();
 *   return <button onClick={clear}>Clear</button>;
 * }
 */
export function bindStoreActions<T, A>(
  store: Store<T>,
  factory: (api: StoreAccess<T>) => A
) {
  return (deps: any[] = []) => useStoreActions(store, factory, deps);
}

/** Map of **pure** root updaters `(root, ...args) => nextRoot`. Must return a new root.
 *  @typeParam T - Root state.
 *  @category Slices
 */
export type RootFns<T> = Record<string, (root: T, ...a: any[]) => T>;

/** Slice-bound action signatures derived from {@link RootFns}. */
type Bound<FNS extends RootFns<any>> = {
  [K in keyof FNS]: (
    ...args: Parameters<FNS[K]> extends [any, ...infer P] ? P : never
  ) => void;
};

/**
 * Create a slice hook bound to a store; actions are **pure** (no side effects)
 * and must return the **next root state**.
 *
 * @typeParam T - Root state.
 * @typeParam S - Selected slice.
 * @typeParam FNS - Pure updater map `(root, ...args) => nextRoot`.
 * @param store - The external store.
 * @param select - `(root) => slice` used for `state` and `get()`.
 * @param fns - Pure updaters; each must return a new root (`T`).
 * @returns `useSlice(): { state, get, actions }` where `actions[key](...args): void`
 * @example
 * const useTodos = createStoreSlice(store, s => s.todos, {
 *   add(root, text: string) {
 *     return { ...root, todos: [...root.todos, { id: crypto.randomUUID(), text }] };
 *   }
 * });
 * @category Slices
 */
export function createStoreSlice<T, S, FNS extends RootFns<T>>(
  store: Store<T>,
  select: (root: T) => S,
  fns: FNS
) {
  return function useSlice(): { state: S; get: () => S; actions: Bound<FNS> } {
    const state = useStoreSelector(store, select);
    const get = React.useCallback(
      () => select(store.getState()),
      [store, select]
    );
    const actions = React.useMemo(() => {
      const out: any = {};
      for (const key in fns) {
        const pure = fns[key];
        out[key] = (...args: any[]) =>
          store.setState((prev) => pure(prev, ...args));
      }
      return out as Bound<FNS>;
    }, [store]);
    return { state, get, actions };
  };
}

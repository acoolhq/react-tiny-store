import * as React from "react";

/** Minimal external store */
type Listener = () => void;
type Store<T> = {
  getState: () => T;
  setState: (u: T | ((p: T) => T)) => void;
  replace: (next: T) => void;
  subscribe: (l: Listener) => () => void;
};
function makeStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    getState: () => state,
    setState: (u) => {
      const next = typeof u === "function" ? (u as (p: T) => T)(state) : u;
      if (!Object.is(next, state)) {
        state = next;
        listeners.forEach((l) => l());
      }
    },
    replace: (next) => {
      if (!Object.is(next, state)) {
        state = next;
        listeners.forEach((l) => l());
      }
    },
    subscribe: (l) => (listeners.add(l), () => listeners.delete(l)),
  };
}

/** Store access exposed to action factories */
export type StoreAccess<T> = {
  get: () => T;
  set: Store<T>["setState"];
  replace: Store<T>["replace"];
};

/**
 * Factory that creates a typed Provider and the three primitives for your app state T.
 * Usage in app code:
 *   const { Provider, useSelector, useActions, bindActions, createSlice } = createContextSync<AppState>();
 */
export function createContextSync<T>() {
  type CtxVal = { store: Store<T>; getServerSnapshot: () => T };
  const Ctx = React.createContext<CtxVal | null>(null);

  function Provider(props: { children: React.ReactNode; initial: T }) {
    const { children, initial } = props;
    const [store] = React.useState(() => makeStore<T>(initial));

    // freeze first server snapshot for hydration
    const hydRef = React.useRef<T | null>(null);
    if (hydRef.current === null) hydRef.current = initial;
    const getServerSnapshot = React.useCallback(() => hydRef.current as T, []);

    return (
      <Ctx.Provider value={{ store, getServerSnapshot }}>
        {children}
      </Ctx.Provider>
    );
  }

  function useStore() {
    const ctx = React.useContext(Ctx);
    if (!ctx)
      throw new Error(
        "react-context-sync: hooks must be used within <Provider>"
      );
    return ctx.store;
  }

  /** Hydration-safe, narrow subscription selector */
  function useSelector<S>(
    selector: (root: T) => S,
    isEqual: (a: S, b: S) => boolean = Object.is
  ): S {
    const ctx = React.useContext(Ctx);
    if (!ctx)
      throw new Error(
        "react-context-sync: hooks must be used within <Provider>"
      );
    const last = React.useRef<S>(selector(ctx.store.getState()));
    return React.useSyncExternalStore(
      ctx.store.subscribe,
      () => {
        const next = selector(ctx.store.getState());
        if (isEqual(last.current, next)) return last.current;
        last.current = next;
        return next;
      },
      () => selector(ctx.getServerSnapshot())
    );
  }

  /** Side-effect controllers (may call other hooks, including slice hooks) */
  function useActions<A>(
    factory: (api: StoreAccess<T>) => A,
    deps: any[] = []
  ): A {
    const { getState, setState, replace } = useStore();
    const api = React.useMemo<StoreAccess<T>>(
      () => ({ get: getState, set: setState, replace }),
      [getState, setState, replace]
    );
    const built = factory(api); // factory can call hooks
    return React.useMemo(() => built, deps);
  }

  /** Sugar to publish a controller as a single hook */
  function bindActions<A>(factory: (api: StoreAccess<T>) => A) {
    return function useBoundActions(deps: any[] = []) {
      return useActions(factory, deps);
    };
  }

  /** Map of PURE root updaters (root -> root). */
  type RootFns = Record<string, (root: T, ...args: any[]) => T>;
  type Bound<FNS extends RootFns> = {
    [K in keyof FNS]: (
      ...args: Parameters<FNS[K]> extends [any, ...infer P] ? P : never
    ) => void;
  };

  /**
   * createSlice(select, fns) -> useSlice()
   * - select(root) => S : what the hook exposes as `state`
   * - fns: PURE functions that return a new root
   * useSlice() returns { state, get, actions }
   */
  function createSlice<S, FNS extends RootFns>(
    select: (root: T) => S,
    fns: FNS
  ) {
    function useSlice(): { state: S; get: () => S; actions: Bound<FNS> } {
      const store = useStore();
      const state = useSelector(select);
      const get = React.useCallback(
        () => select(store.getState()),
        [store, select]
      );

      const actions = React.useMemo(() => {
        const out: any = {};
        for (const key in fns) {
          const pure = fns[key];
          out[key] = (...args: any[]) => {
            store.setState((prev) => pure(prev, ...args));
          };
        }
        return out as Bound<FNS>;
      }, [store]);
      return { state, get, actions };
    }

    // expose pure fns in case controllers want to reuse them
    (useSlice as any).pure = fns;
    return useSlice as (() => {
      state: S;
      get: () => S;
      actions: Bound<FNS>;
    }) & { pure: FNS };
  }

  return { Provider, useSelector, useActions, bindActions, createSlice };
}

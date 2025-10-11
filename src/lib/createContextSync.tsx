import * as React from "react";

/* =============================================================================
   Minimal store (class-based) with an initial snapshot for SSR
============================================================================= */

export type Listener = () => void;

export type Store<T> = {
  getState: () => T;
  setState: (u: T | ((p: T) => T)) => void;
  replace: (next: T) => void;
  subscribe: (l: Listener) => () => void;
  getInitialState: () => T; // frozen at construction time
};

class TinyStore<T> implements Store<T> {
  private _state: T;
  private readonly _initial: T;
  private _listeners = new Set<Listener>();

  constructor(initial: T) {
    this._state = initial;
    this._initial = initial;
  }

  getState = (): T => this._state;

  setState = (u: T | ((p: T) => T)) => {
    const next = typeof u === "function" ? (u as (p: T) => T)(this._state) : u;
    if (!Object.is(next, this._state)) {
      this._state = next;
      for (const l of Array.from(this._listeners)) l();
    }
  };

  replace = (next: T) => {
    if (!Object.is(next, this._state)) {
      this._state = next;
      for (const l of Array.from(this._listeners)) l();
    }
  };

  subscribe = (l: Listener) => {
    this._listeners.add(l);
    return () => this._listeners.delete(l);
  };

  getInitialState = () => this._initial;
}

export function makeStore<T>(initial: T): Store<T> {
  return new TinyStore<T>(initial);
}

/* =============================================================================
   Store-param React helpers (no context required)
============================================================================= */

export type StoreAccess<T> = {
  get: () => T;
  set: Store<T>["setState"];
  replace: Store<T>["replace"];
};

/** useSelector with store first; resets baseline if selector/equality identities change */
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

/** Controllers (actions) with store first; factory may call other hooks */
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
    }),
    [store]
  );
  const built = factory(api); // allow hooks inside factory
  return React.useMemo(() => built, deps);
}

/** bind factory to a store -> returns a hook */
export function bindStoreActions<T, A>(
  store: Store<T>,
  factory: (api: StoreAccess<T>) => A
) {
  return (deps: any[] = []) => useStoreActions(store, factory, deps);
}

/** create a slice hook bound to a store */
type RootFns<T> = Record<string, (root: T, ...a: any[]) => T>;
type Bound<FNS extends RootFns<any>> = {
  [K in keyof FNS]: (
    ...args: Parameters<FNS[K]> extends [any, ...infer P] ? P : never
  ) => void;
};

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

/* =============================================================================
   Context wrapper (Provider) that reuses the same store-param helpers
   - Provider creates the store once with initial
   - useSelector/actions/slice just bind to the context store
   - Server snapshot comes from store.getInitialState() (no extra arg)
============================================================================= */

export function createContextSync<T>() {
  const Ctx = React.createContext<Store<T> | null>(null);

  function Provider({
    children,
    initial,
  }: {
    children: React.ReactNode;
    initial: T;
  }) {
    const [store] = React.useState(() => makeStore<T>(initial));
    return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
  }

  function useStore(): Store<T> {
    const store = React.useContext(Ctx);
    if (!store)
      throw new Error(
        "react-context-sync: hooks must be used within <Provider>"
      );
    return store;
  }

  function useSelector<S>(
    selector: (root: T) => S,
    isEqual: (a: S, b: S) => boolean = Object.is
  ) {
    return useStoreSelector(useStore(), selector, isEqual);
  }

  function useActions<A>(
    factory: (api: StoreAccess<T>) => A,
    deps: any[] = []
  ) {
    return useStoreActions(useStore(), factory, deps);
  }

  function bindActions<A>(factory: (api: StoreAccess<T>) => A) {
    return (deps: any[] = []) => useStoreActions(useStore(), factory, deps);
  }

  function createSlice<S, FNS extends RootFns<T>>(
    select: (root: T) => S,
    fns: FNS
  ) {
    return () => createStoreSlice(useStore(), select, fns)();
  }

  return { Provider, useSelector, useActions, bindActions, createSlice };
}

import * as React from "react";

/* =============================================================================
   Minimal store (class-based) with an initial snapshot for SSR
============================================================================= */

/** Callback fired after state changes. */
export type Listener = () => void;

/**
 * Minimal external store (usually consumed via hooks).
 * @typeParam T - State shape.
 */
export type Store<T> = {
  /** Read current state (sync). */
  getState: () => T;
  /** Set next state or updater; notifies if changed. */
  setState: (u: T | ((p: T) => T)) => void;
  /** Replace entire state; notifies if changed. */
  replace: (next: T) => void;
  /** Subscribe to changes. Returns an unsubscribe function. */
  subscribe: (l: Listener) => () => void;
  /** Initial state captured at construction (for hydration). */
  getInitialState: () => T;
};

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

/**
 * Create a minimal external store.
 *
 * @typeParam T - Root state shape.
 * @param initial - Initial state; also captured for `getInitialState()`.
 * @returns A `Store<T>` with `getState`, `setState`, `replace`, `subscribe`, and `getInitialState`.
 * @category Store
 *
 * @example
 * const store = makeStore({ count: 0 });
 * store.setState(p => ({ ...p, count: p.count + 1 }));
 */
export function makeStore<T>(initial: T): Store<T> {
  return new TinyStore<T>(initial);
}

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
type RootFns<T> = Record<string, (root: T, ...a: any[]) => T>;

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

/* =============================================================================
   Context wrapper (Provider) that reuses the same store-param helpers
   - Provider creates the store once with initial
   - useSelector/actions/slice just bind to the context store
   - Server snapshot comes from store.getInitialState() (no extra arg)
============================================================================= */

/**
 * Creates a typed Context wrapper around an internal store.
 *
 * @typeParam T - Root state shape.
 * @returns An object with:
 * - `Provider`: `<Provider initial>{children}</Provider>`
 * - `useSelector(selector, isEqual?)`
 * - `useActions(factory, deps?)`
 * - `bindActions(factory) -> (deps?) => actions`
 * - `createSlice(select, fns) -> () => { state, get, actions }`
 * @category Store
 *
 * @example
 * type AppState = { tick: number; todos: { id: string; text: string }[] };
 * const Tiny = createContextSync<AppState>();
 *
 * function App() {
 *   return (
 *     <Tiny.Provider initial={{ tick: 0, todos: [] }}>
 *       <UI />
 *     </Tiny.Provider>
 *   );
 * }
 */
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

  /** @internal */
  function useStore(): Store<T> {
    const store = React.useContext(Ctx);
    if (!store)
      throw new Error(
        "react-context-sync: hooks must be used within <Provider>"
      );
    return store;
  }

  /**
   * Selects a derived value from the context store with granular re-renders.
   *
   * @typeParam S - Selected slice shape.
   * @param selector - Pure selector `(root) => slice`.
   * @param isEqual - Optional equality to suppress updates (default `Object.is`).
   * @returns The selected value `S`, updated only when `isEqual(prev, next)` is false.
   */
  function useSelector<S>(
    selector: (root: T) => S,
    isEqual: (a: S, b: S) => boolean = Object.is
  ) {
    return useStoreSelector(useStore(), selector, isEqual);
  }

  /**
   * Build **controller** actions (side-effects/async allowed) from the context store.
   *
   * @typeParam A - Actions shape.
   * @param factory - `(api) => actions`
   * @param deps - Memo deps for the returned actions.
   * @returns Actions `A` (controller actions).
   * @category Controllers
   */
  function useActions<A>(
    factory: (api: StoreAccess<T>) => A,
    deps: any[] = []
  ) {
    return useStoreActions(useStore(), factory, deps);
  }

  /**
   * Bind a **controller** factory to the context store and get a hook.
   * @typeParam A - Actions shape.
   * @returns `(deps?) => A`
   * @category Controllers
   */
  function bindActions<A>(factory: (api: StoreAccess<T>) => A) {
    return (deps: any[] = []) => useStoreActions(useStore(), factory, deps);
  }

  /**
   * Create a **pure slice** hook from the context store.
   * Actions must be pure updaters that return the **next root state**.
   * @typeParam S - Selected slice.
   * @typeParam FNS - Pure updater map `(root, ...args) => nextRoot`.
   * @returns `() => { state, get, actions }`
   * @category Slices
   */
  function createSlice<S, FNS extends RootFns<T>>(
    select: (root: T) => S,
    fns: FNS
  ) {
    return () => createStoreSlice(useStore(), select, fns)();
  }

  return { Provider, useSelector, useActions, bindActions, createSlice };
}

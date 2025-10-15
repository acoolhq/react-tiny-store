import * as React from "react";
import { type Store, makeStore } from "./store";
import {
  type RootFns,
  type StoreAccess,
  createStoreSlice,
  useStoreActions,
  useStoreSelector,
} from "./hooks";

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

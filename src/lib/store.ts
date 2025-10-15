export type Notifier = () => void;

/**
 * Minimal, synchronous batching coordinator.
 *
 * - Collects multiple notifications (from one or many stores) and flushes them **once**
 *   when the outermost batch completes.
 * - Supports **nested** batches via a depth counter.
 * - De-duplicates notifiers using a `Set`, so each store is notified at most once per batch.
 *
 * @example
 * new BatchNotifier().run(() => {
 *   storeA.setState(...); // schedules notify
 *   storeB.setState(...); // schedules notify
 * }); // both stores notify once total
 */
class BatchNotifier {
  private _depth = 0;
  private readonly _queue = new Set<Notifier>();

  /**
   * Flush all queued notifiers (called automatically when the outer batch ends).
   * @internal
   */
  private _flush() {
    if (this._queue.size) {
      const run = Array.from(this._queue);
      this._queue.clear();
      for (const n of run) n();
    }
  }

  /**
   * Run a synchronous batch. Any `enqueue()` calls inside are queued and
   * delivered once when the outermost batch completes.
   *
   * @param fn - Work to execute within the batch (must be synchronous).
   * @remarks
   * Do not `await` inside `fn`. For async flows, wrap each synchronous segment in its own `batch`.
   */
  run(fn: () => void): void {
    this._depth++;
    try {
      fn();
    } finally {
      this._depth--;
      if (this._depth === 0) this._flush();
    }
  }

  /**
   * Queue (or immediately invoke) a notifier depending on whether a batch is active.
   * De-duplicates identical notifiers within the same batch.
   *
   * @param n - A stable notifier function (e.g. a bound/arrow method).
   */
  enqueue(n: Notifier) {
    if (this._depth > 0) {
      this._queue.add(n); // dedupe: one notify per store per batch
    } else {
      n(); // outside a batch → immediate
    }
  }
}

const batching = new BatchNotifier();

/**
 * Run several updates as a single batch so subscribers are notified once.
 *
 * @param fn A batch function with setState calls inside it.
 * @category Store
 * @example
 * batch(() => {
 *   store.setState(p => ({ ...p, a: p.a + 1 }));
 *   store.setState(p => ({ ...p, b: p.b + 1 }));
 * }); // one notify after the batch
 *
 */
export function batch(fn: () => void) {
  batching.run(fn);
}

/**
 * Internal helper for stores to schedule notifications through the global batcher.
 * Typically called from within a store after mutating state.
 *
 * @example
 * // inside a store:
 * enqueueNotify(this._notifyNow);
 */
function enqueueNotify(n: Notifier) {
  batching.enqueue(n);
}

/** Callback fired after state changes. */
export type Listener = () => void;

/**
 * Minimal external store (usually consumed via hooks).
 * @typeParam T - State shape.
 */
export interface Store<T> {
  /** Read current state (sync). */
  getState: () => T;
  /** Set next state or updater; notifies if changed. */
  setState: (u: T | ((p: T) => T)) => void;
  /** Replace entire state; notifies if changed. */
  replace: (next: T) => void;
  /** Reset to the initial state captured at construction. */
  reset: () => void;
  /** Subscribe to changes. Returns an unsubscribe function. */
  subscribe: (l: Listener) => () => void;
  /** Initial state captured at construction (for hydration). */
  getInitialState: () => T;
}

class TinyStore<T> implements Store<T> {
  private _state: T;
  private readonly _initial: T;
  private _listeners = new Set<Listener>();

  constructor(initial: T) {
    this._state = initial;
    this._initial = initial;
  }

  private _notify = () => {
    for (const l of Array.from(this._listeners)) l();
  };

  getState = (): T => this._state;

  setState = (u: T | ((p: T) => T)) => {
    const next = typeof u === "function" ? (u as (p: T) => T)(this._state) : u;
    if (!Object.is(next, this._state)) {
      this._state = next;
      enqueueNotify(this._notify);
    }
  };

  replace = (next: T) => {
    if (!Object.is(next, this._state)) {
      this._state = next;
      enqueueNotify(this._notify);
    }
  };

  reset = () => {
    if (!Object.is(this._initial, this._state)) {
      this._state = this._initial;
      enqueueNotify(this._notify);
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

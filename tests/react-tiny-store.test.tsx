import React from "react";
import { renderToString } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { createContextSync } from "../src";

type Todo = { id: string; text: string; optimistic?: boolean };
type AppState = { todos: Todo[]; ui: { modalOpen: boolean } };

const { Provider, useSelector, bindActions, createSlice } =
  createContextSync<AppState>();

function withProvider(initial: AppState) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider initial={initial}>{children}</Provider>
  );
  return { wrapper };
}

describe("@acool/react-tiny-store - proper cases", () => {
  it("uses getServerSnapshot during SSR", () => {
    const initial: AppState = {
      todos: [{ id: "1", text: "A" }],
      ui: { modalOpen: false },
    };

    function SSRRead() {
      const len = useSelector((s) => s.todos.length);
      return <div data-len={len}>SSR</div>;
    }

    const html = renderToString(
      <Provider initial={initial}>
        <SSRRead />
      </Provider>
    );

    expect(html).toContain('data-len="1"');
  });

  it("useSelector returns selected value and updates on state change", () => {
    const initial: AppState = { todos: [], ui: { modalOpen: false } };

    const useTodos = createSlice((r) => r.todos, {
      add(r, t: Todo) {
        return { ...r, todos: [t, ...r.todos] };
      },
    });

    // ✅ Compose selector + slice into a single hook so they share ONE Provider/store
    function useEnv() {
      const len = useSelector((s) => s.todos.length);
      const todos = useTodos();
      return { len, todos };
    }

    const { wrapper } = withProvider(initial);
    const { result } = renderHook(() => useEnv(), { wrapper });

    expect(result.current.len).toBe(0);

    act(() => {
      result.current.todos.actions.add({ id: "1", text: "A" });
    });

    expect(result.current.len).toBe(1);
    expect(result.current.todos.state[0].text).toBe("A");
  });

  it("createSlice actions are pure and can chain updates", () => {
    const initial: AppState = { todos: [], ui: { modalOpen: false } };

    const useTodos = createSlice((r) => r.todos, {
      add(r, t: Todo) {
        return { ...r, todos: [t, ...r.todos] };
      },
      remove(r, id: string) {
        return { ...r, todos: r.todos.filter((x) => x.id !== id) };
      },
    });

    const { wrapper } = withProvider(initial);
    const { result } = renderHook(() => useTodos(), { wrapper });

    act(() => {
      result.current.actions.add({ id: "1", text: "A" });
      result.current.actions.add({ id: "2", text: "B" });
    });
    expect(result.current.state.map((t) => t.id)).toEqual(["2", "1"]);

    act(() => {
      result.current.actions.remove("1");
    });
    expect(result.current.state.map((t) => t.id)).toEqual(["2"]);
  });

  it("slice.get() returns the freshest value synchronously after updates", () => {
    const initial: AppState = { todos: [], ui: { modalOpen: false } };

    const useTodos = createSlice((r) => r.todos, {
      add(r, t: Todo) {
        return { ...r, todos: [t, ...r.todos] };
      },
    });

    const { wrapper } = withProvider(initial);
    const { result } = renderHook(() => useTodos(), { wrapper });

    act(() => {
      result.current.actions.add({ id: "1", text: "A" });
    });

    expect(result.current.get()[0].id).toBe("1");
  });

  it("useActions factory can call slice hooks and do side-effects", async () => {
    const initial: AppState = { todos: [], ui: { modalOpen: false } };

    const useTodos = createSlice((r) => r.todos, {
      add(r, t: Todo) {
        return { ...r, todos: [t, ...r.todos] };
      },
      confirm(r, tempId: string, real: Todo) {
        return {
          ...r,
          todos: r.todos.map((t) =>
            t.id === tempId ? { ...real, optimistic: false } : t
          ),
        };
      },
      remove(r, id: string) {
        return { ...r, todos: r.todos.filter((t) => t.id !== id) };
      },
    });

    const useTodosActions = bindActions((_api) => {
      const { actions: todos } = useTodos();
      return {
        async addAndPersist(text: string) {
          const temp = { id: `tmp-1`, text, optimistic: true };
          todos.add(temp);
          try {
            const res = await fetch("/api/todos", { method: "POST" } as any);
            const real = await (res as any).json();
            todos.confirm(temp.id, real);
          } catch {
            todos.remove(temp.id);
          }
        },
      };
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "r-1", text: "A" }),
    });
    (globalThis as any).fetch = fetchMock;

    // ✅ Compose slice + controller into ONE hook so they share a store
    function useEnv() {
      const slice = useTodos();
      const actions = useTodosActions();
      return { slice, actions };
    }

    const { wrapper } = withProvider(initial);
    const { result } = renderHook(() => useEnv(), { wrapper });

    await act(async () => {
      await result.current.actions.addAndPersist("A");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/todos", expect.anything());
    expect(result.current.slice.state[0]).toEqual({
      id: "r-1",
      text: "A",
      optimistic: false,
    });
  });

  it("bindActions deps control identity stability", () => {
    const initial: AppState = { todos: [], ui: { modalOpen: false } };

    const useById = (id: string) =>
      bindActions(() => {
        return { doThing: () => id };
      })([id]);

    const { wrapper } = withProvider(initial);

    const { result: r1, rerender } = renderHook(({ id }) => useById(id), {
      wrapper,
      initialProps: { id: "a" },
    });

    const a1 = r1.current.doThing;
    rerender({ id: "a" });
    const a2 = r1.current.doThing;
    expect(a2).toBe(a1);

    rerender({ id: "b" });
    const a3 = r1.current.doThing;
    expect(a3).not.toBe(a1);
  });

  it("useSelector equality function can prevent updates when value is equal", () => {
    const initial: AppState = { todos: [], ui: { modalOpen: false } };
    const useUI = createSlice((r) => r.ui, {
      toggle(r) {
        return { ...r, ui: { modalOpen: !r.ui.modalOpen } };
      },
    });

    function useEnv() {
      const len = useSelector((s) => s.todos.length, Object.is);
      const ui = useUI();
      return { len, ui };
    }

    const { wrapper } = withProvider(initial);
    const { result } = renderHook(() => useEnv(), { wrapper });

    expect(result.current.len).toBe(0);

    act(() => {
      result.current.ui.actions.toggle();
    });

    expect(result.current.len).toBe(0);
  });

  it("updates after unmount do not crash and do not update unmounted consumers", () => {
    const initial: AppState = { todos: [], ui: { modalOpen: false } };
    const useTodos = createSlice((r) => r.todos, {
      add(r, t: Todo) {
        return { ...r, todos: [t, ...r.todos] };
      },
    });

    const { wrapper } = withProvider(initial);

    const { result, unmount } = renderHook(() => useTodos(), { wrapper });
    unmount();

    expect(() =>
      act(() => {
        result.current.actions.add({ id: "1", text: "A" });
      })
    ).not.toThrow();
  });

  it("api.replace swaps the whole state and notifies subscribers", () => {
    const initial: AppState = { todos: [], ui: { modalOpen: false } };

    // Controller that uses api.replace
    const useReplaceAll = bindActions((api) => ({
      replaceAll(next: AppState) {
        api.replace(next);
      },
    }));

    function useEnv() {
      const len = useSelector((s) => s.todos.length);
      const actions = useReplaceAll();
      return { len, actions };
    }

    const { wrapper } = withProvider(initial);
    const { result } = renderHook(() => useEnv(), { wrapper });

    expect(result.current.len).toBe(0);

    act(() => {
      result.current.actions.replaceAll({
        todos: [{ id: "x", text: "Z" }],
        ui: { modalOpen: true },
      });
    });

    expect(result.current.len).toBe(1);
  });

  it("api.set replaces state with a plain value (non-functional path)", () => {
    const initial: AppState = { todos: [], ui: { modalOpen: false } };

    // controller that calls api.set with a plain object (not prev => next)
    const useUIActions = bindActions((api) => ({
      openModal() {
        const curr = api.get();
        const next: AppState = { ...curr, ui: { ...curr.ui, modalOpen: true } };
        api.set(next); // <-- plain set (non-functional)
      },
    }));

    // compose selector + controller so they share one Provider/store
    function useEnv() {
      const open = useSelector((s) => s.ui.modalOpen);
      const actions = useUIActions();
      return { open, actions };
    }

    const { wrapper } = withProvider(initial);
    const { result } = renderHook(() => useEnv(), { wrapper });

    expect(result.current.open).toBe(false);

    act(() => {
      result.current.actions.openModal();
    });

    expect(result.current.open).toBe(true);
  });
});

describe("@acool/react-tiny-store - context error throws (outside <Provider>)", () => {
  type AppState = { count: number; ui: { modalOpen: boolean } };

  const {
    // Provider is intentionally NOT used in these tests
    useSelector,
    useActions,
    bindActions,
    createSlice,
  } = createContextSync<AppState>();

  const ERR = /hooks must be used within <Provider>/; // be flexible on the prefix

  it("useSelector throws if used without Provider", () => {
    const boom = () => renderHook(() => useSelector((s) => s.count)); // no wrapper/Provider
    expect(boom).toThrowError(ERR);
  });

  it("useActions throws if used without Provider", () => {
    const boom = () => renderHook(() => useActions(() => ({ ok: () => {} })));
    expect(boom).toThrowError(ERR);
  });

  it("bindActions throws if used without Provider", () => {
    const useOk = bindActions(() => ({ ok: () => {} }));
    const boom = () => renderHook(() => useOk());
    expect(boom).toThrowError(ERR);
  });

  it("createSlice/useSlice throws if used without Provider", () => {
    const useCount = createSlice((r) => r.count, {
      inc(r) {
        return { ...r, count: r.count + 1 };
      },
    });
    const boom = () => renderHook(() => useCount());
    expect(boom).toThrowError(ERR);
  });
});

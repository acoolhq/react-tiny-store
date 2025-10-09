"use client";
import { bindActions } from "./appStore";
import { useTodos } from "./slices";

export const useTodosActions = bindActions(() => {
  const { actions: todo } = useTodos();

  return {
    async addAndPersist(text: string) {
      const tmp = { id: `tmp-${Date.now()}`, text, optimistic: true };
      todo.add(tmp);
      try {
        const res = await fetch("/api/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error("create failed");
        const real = await res.json();
        todo.confirm(tmp.id, real);
      } catch {
        todo.remove(tmp.id);
        const fresh = await fetch("/api/todos").then((r) => r.json());
        todo.replaceAll(fresh);
      }
    },
  };
});

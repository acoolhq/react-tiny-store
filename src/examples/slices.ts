import { createSlice } from "./appStore";
import type { AppState } from "./appStore";
type Todo = AppState["todos"][number];

export const useTodos = createSlice((root: any) => root.todos, {
  add(root: any, todo: Todo) {
    return { ...root, todos: [todo, ...root.todos] };
  },
  confirm(root: any, tempId: string, real: Todo) {
    return {
      ...root,
      todos: root.todos.map((t: any) =>
        t.id === tempId ? { ...real, optimistic: false } : t
      ),
    };
  },
  remove(root: any, id: string) {
    return { ...root, todos: root.todos.filter((t: any) => t.id !== id) };
  },
  replaceAll(root: any, next: Todo[]) {
    return { ...root, todos: next };
  },
});

export const useModal = createSlice((root: any) => root.ui.modalOpen, {
  toggle(root: any) {
    return { ...root, ui: { ...root.ui, modalOpen: !root.ui.modalOpen } };
  },
  set(root: any, v: boolean) {
    return { ...root, ui: { ...root.ui, modalOpen: v } };
  },
});

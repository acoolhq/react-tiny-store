import { createContextSync } from "@acoolhq/react-tiny-store";

export type Todo = { id: string; text: string; optimistic?: boolean };
export type AppState = { todos: Todo[]; ui: { modalOpen: boolean } };

export const {
  Provider: AppProvider,
  useSelector,
  useActions,
  bindActions,
  createSlice,
} = createContextSync<AppState>();

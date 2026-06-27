import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/rpc.ts";

function useTodos() {
  return useQuery({
    queryKey: ["todos"],
    queryFn: async () => {
      const res = await api.todos.$get();
      if (!res.ok) throw new Error("Failed to load todos");
      return res.json();
    },
  });
}

export default function Index() {
  const queryClient = useQueryClient();
  const { data, isPending, error } = useTodos();

  const [title, setTitle] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["todos"] });

  const addTodo = useMutation({
    mutationFn: async (input: { title: string }) => {
      const res = await api.todos.$post({ json: input });
      if (!res.ok) throw new Error("Failed to add todo");
      return res.json();
    },
    onSuccess: () => {
      setTitle("");
      invalidate();
    },
  });

  const toggleTodo = useMutation({
    mutationFn: async (input: { id: string; completed: boolean }) => {
      const res = await api.todos[":id"].$patch({
        param: { id: input.id },
        json: { completed: input.completed },
      });
      if (!res.ok) throw new Error("Failed to update todo");
      return res.json();
    },
    onSuccess: invalidate,
  });

  const deleteTodo = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.todos[":id"].$delete({ param: { id } });
      if (!res.ok) throw new Error("Failed to delete todo");
    },
    onSuccess: invalidate,
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (title.trim() === "") return;
    addTodo.mutate({ title: title.trim() });
  };

  if (isPending) return <p>Loading…</p>;
  if (error) return <p className="error">{error.message}</p>;

  return (
    <section>
      <form onSubmit={onSubmit} className="add-form">
        <input
          type="text"
          placeholder="What needs doing?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button type="submit" disabled={addTodo.isPending}>
          {addTodo.isPending ? "Adding…" : "Add"}
        </button>
      </form>

      <ul className="todos">
        {data.todos.map((todo) => (
          <li key={todo.id} className={todo.completed ? "done" : undefined}>
            <label>
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={(e) =>
                  toggleTodo.mutate({ id: todo.id, completed: e.target.checked })
                }
              />
              <span className="title">{todo.title}</span>
            </label>
            <button
              className="delete"
              onClick={() => deleteTodo.mutate(todo.id)}
              disabled={deleteTodo.isPending}
              aria-label="Delete todo"
            >
              ✕
            </button>
          </li>
        ))}
        {data.todos.length === 0 && <li className="empty">Nothing yet — add one above.</li>}
      </ul>
    </section>
  );
}

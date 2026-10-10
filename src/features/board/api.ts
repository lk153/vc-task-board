"use client";

import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { POLL_MS } from "@/config/board";
import { planBulkMove, positionAtEnd, sortTasks, type TaskMove } from "@/domain/ordering";
import type { BoardSummary, BoardView, Invite, Task, UpdateTaskInput } from "@/domain/task";
import { api, ApiError } from "@/lib/api-client";
import { useUi } from "@/store/ui-store";

export const boardKey = (boardId: string) => ["board", boardId] as const;
export const boardsKey = ["boards"] as const;

/** The open board. Refetches on focus and every POLL_MS, except while dragging or saving. */
export function useBoard(boardId: string, initialData: BoardView) {
  const dragging = useUi((s) => s.dragging);
  const saving = useIsMutating({ mutationKey: boardKey(boardId) }) > 0;
  return useQuery({
    queryKey: boardKey(boardId),
    queryFn: () => api<BoardView>(`/api/boards/${boardId}`),
    initialData,
    refetchInterval: dragging || saving ? false : POLL_MS,
  });
}

export function useBoards(initialData: BoardSummary[]) {
  return useQuery({
    queryKey: boardsKey,
    queryFn: () => api<BoardSummary[]>("/api/boards"),
    initialData,
  });
}

function saveErrorMessage(error: unknown) {
  if (
    error instanceof ApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 404
  ) {
    return `Couldn't save — ${error.message}`;
  }
  return "Couldn't save — change undone";
}

/**
 * Board mutation with an optimistic cache update. On error the previous view
 * is restored and a toast explains; afterwards the board is refetched (once,
 * when the last concurrent mutation settles).
 */
function useBoardMutation<Vars, Result>(
  boardId: string,
  options: {
    mutationFn: (vars: Vars) => Promise<Result>;
    apply?: (view: BoardView, vars: Vars) => BoardView;
    settle?: (view: BoardView, result: Result, vars: Vars) => BoardView;
  },
) {
  const queryClient = useQueryClient();
  const key = boardKey(boardId);
  return useMutation({
    mutationKey: key,
    mutationFn: options.mutationFn,
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<BoardView>(key);
      if (previous && options.apply) queryClient.setQueryData(key, options.apply(previous, vars));
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      useUi.getState().showToast(saveErrorMessage(error));
    },
    onSuccess: (result, vars) => {
      if (options.settle) {
        queryClient.setQueryData<BoardView>(
          key,
          (view) => view && options.settle!(view, result, vars),
        );
      }
    },
    onSettled: () => refetchWhenIdle(queryClient, key),
  });
}

function refetchWhenIdle(queryClient: QueryClient, key: readonly unknown[]) {
  if (queryClient.isMutating({ mutationKey: key }) <= 1) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
}

const replaceTask = (view: BoardView, task: Task): BoardView => ({
  ...view,
  tasks: sortTasks(view.tasks.map((t) => (t.id === task.id ? task : t))),
});

const withTask = (view: BoardView, task: Task): BoardView => ({
  ...view,
  tasks: sortTasks([...view.tasks.filter((t) => t.id !== task.id), task]),
});

// ─── Tasks ──────────────────────────────────────────────────────────────────

/** Create from a complete optimistic task (client-generated id and position). */
export function useCreateTask(boardId: string) {
  return useBoardMutation(boardId, {
    mutationFn: (task: Task) =>
      api<Task>(`/api/boards/${boardId}/tasks`, {
        method: "POST",
        body: {
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          type: task.type,
          assigneeId: task.assigneeId,
          points: task.points,
        },
      }),
    apply: withTask,
    settle: (view, saved) => replaceTask(view, saved),
  });
}

/** Update fields and/or move (`status` + `position`). Send only what changed. */
export function useUpdateTask(boardId: string) {
  return useBoardMutation(boardId, {
    mutationFn: ({ taskId, patch }: { taskId: string; patch: UpdateTaskInput }) =>
      api<Task>(`/api/boards/${boardId}/tasks/${taskId}`, { method: "PATCH", body: patch }),
    apply: (view, { taskId, patch }) => {
      const current = view.tasks.find((t) => t.id === taskId);
      if (!current) return view;
      const movedColumn = patch.status && patch.status !== current.status;
      const position =
        patch.position ??
        (movedColumn
          ? positionAtEnd(view.tasks.filter((t) => t.status === patch.status))
          : current.position);
      return replaceTask(view, { ...current, ...patch, position });
    },
    settle: (view, saved) => replaceTask(view, saved),
  });
}

export function useDeleteTask(boardId: string) {
  return useBoardMutation(boardId, {
    mutationFn: (task: Task) =>
      api<void>(`/api/boards/${boardId}/tasks/${task.id}`, { method: "DELETE" }),
    apply: (view, task) => ({ ...view, tasks: view.tasks.filter((t) => t.id !== task.id) }),
  });
}

/** Undo a delete: the task comes back with its original column and position. */
export function useRestoreTask(boardId: string) {
  return useBoardMutation(boardId, {
    mutationFn: (task: Task) =>
      api<Task>(`/api/boards/${boardId}/tasks/${task.id}/restore`, { method: "POST" }),
    apply: withTask,
    settle: (view, saved) => replaceTask(view, saved),
  });
}

/** Bulk status change (and its Undo, which passes exact positions). */
export function useBulkMoveTasks(boardId: string) {
  return useBoardMutation(boardId, {
    mutationFn: (moves: TaskMove[]) =>
      api<Task[]>(`/api/boards/${boardId}/tasks`, { method: "PATCH", body: { tasks: moves } }),
    apply: (view, moves) => {
      const plan = new Map(planBulkMove(view.tasks, moves).map((m) => [m.id, m]));
      return {
        ...view,
        tasks: sortTasks(
          view.tasks.map((t) => {
            const move = plan.get(t.id);
            return move ? { ...t, status: move.status, position: move.position } : t;
          }),
        ),
      };
    },
    settle: (view, saved) => saved.reduce(replaceTask, view),
  });
}

// ─── Sharing ────────────────────────────────────────────────────────────────

export function useCreateInvite(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) =>
      api<Invite>(`/api/boards/${boardId}/invites`, { method: "POST", body: { email } }),
    onSuccess: (invite) => {
      queryClient.setQueryData<BoardView>(boardKey(boardId), (view) =>
        view
          ? {
              ...view,
              invites: [...view.invites.filter((i) => i.email !== invite.email), invite],
            }
          : view,
      );
    },
  });
}

export function useCancelInvite(boardId: string) {
  return useBoardMutation(boardId, {
    mutationFn: (inviteId: string) =>
      api<void>(`/api/boards/${boardId}/invites/${inviteId}`, { method: "DELETE" }),
    apply: (view, inviteId) => ({
      ...view,
      invites: view.invites.filter((i) => i.id !== inviteId),
    }),
  });
}

/** Remove a member (owners) or leave the board (yourself). */
export function useRemoveMember(boardId: string) {
  return useBoardMutation(boardId, {
    mutationFn: (userId: string) =>
      api<void>(`/api/boards/${boardId}/members/${userId}`, { method: "DELETE" }),
    apply: (view, userId) => ({
      ...view,
      members: view.members.filter((m) => m.userId !== userId),
      tasks: view.tasks.map((t) => (t.assigneeId === userId ? { ...t, assigneeId: null } : t)),
    }),
  });
}

// ─── Boards ─────────────────────────────────────────────────────────────────

export function useCreateBoard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api<BoardSummary>("/api/boards", { method: "POST", body: { name } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boardsKey }),
  });
}

export function useRenameBoard(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api<BoardSummary>(`/api/boards/${boardId}`, { method: "PATCH", body: { name } }),
    onSuccess: (saved) => {
      queryClient.setQueryData<BoardView>(boardKey(boardId), (view) =>
        view ? { ...view, board: { ...view.board, name: saved.name } } : view,
      );
      queryClient.setQueryData<BoardSummary[]>(boardsKey, (boards) =>
        boards?.map((b) => (b.id === boardId ? { ...b, name: saved.name } : b)),
      );
    },
  });
}

export function useDeleteBoard(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/boards/${boardId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: boardKey(boardId) });
      void queryClient.invalidateQueries({ queryKey: boardsKey });
    },
  });
}

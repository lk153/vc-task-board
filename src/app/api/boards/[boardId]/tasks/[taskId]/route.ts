import { readJson, requireSession, route } from "@/server/http";
import { deleteTask, updateTask } from "@/server/services/tasks";

type Context = RouteContext<"/api/boards/[boardId]/tasks/[taskId]">;

/** Update fields, or move the task (`status` + `position`). Clients send only changed fields. */
export const PATCH = route(async (request, { params }: Context) => {
  const user = await requireSession();
  const { boardId, taskId } = await params;
  return updateTask(user.id, boardId, taskId, await readJson(request));
});

/** Soft delete — `POST …/restore` undoes it. */
export const DELETE = route(async (_request, { params }: Context) => {
  const user = await requireSession();
  const { boardId, taskId } = await params;
  await deleteTask(user.id, boardId, taskId);
});

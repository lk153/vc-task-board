import { readJson, requireSession, route } from "@/server/http";
import { deleteTaskType, updateTaskType } from "@/server/services/task-types";

type Context = RouteContext<"/api/boards/[boardId]/types/[typeId]">;

/** Rename, recolor, or set / unset it as the type for new tasks (`isDefault`). */
export const PATCH = route(async (request, { params }: Context) => {
  const user = await requireSession();
  const { boardId, typeId } = await params;
  return updateTaskType(user.id, boardId, typeId, await readJson(request));
});

/** Remove the type. Its tasks get `?moveTo=<typeId>` instead, or no type. */
export const DELETE = route(async (request, { params }: Context) => {
  const user = await requireSession();
  const { boardId, typeId } = await params;
  const moveTo = new URL(request.url).searchParams.get("moveTo");
  await deleteTaskType(user.id, boardId, typeId, moveTo);
});

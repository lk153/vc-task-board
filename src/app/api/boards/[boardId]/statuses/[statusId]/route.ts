import { readJson, requireSession, route } from "@/server/http";
import { deleteStatus, updateStatus } from "@/server/services/statuses";

type Context = RouteContext<"/api/boards/[boardId]/statuses/[statusId]">;

/** Rename, recolor, move (`position`) or make it the column for new tasks (`isDefault: true`). */
export const PATCH = route(async (request, { params }: Context) => {
  const user = await requireSession();
  const { boardId, statusId } = await params;
  return updateStatus(user.id, boardId, statusId, await readJson(request));
});

/** Remove the column. If it has tasks, `?moveTo=<statusId>` says where they go. */
export const DELETE = route(async (request, { params }: Context) => {
  const user = await requireSession();
  const { boardId, statusId } = await params;
  const moveTo = new URL(request.url).searchParams.get("moveTo");
  await deleteStatus(user.id, boardId, statusId, moveTo);
});

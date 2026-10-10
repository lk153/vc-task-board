import { requireSession, route } from "@/server/http";
import { restoreTask } from "@/server/services/tasks";

/** Undo a delete. */
export const POST = route(
  async (_request, { params }: RouteContext<"/api/boards/[boardId]/tasks/[taskId]/restore">) => {
    const user = await requireSession();
    const { boardId, taskId } = await params;
    return restoreTask(user.id, boardId, taskId);
  },
);

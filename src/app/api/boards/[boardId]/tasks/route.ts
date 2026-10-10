import { readJson, requireSession, route } from "@/server/http";
import { bulkMoveTasks, createTask } from "@/server/services/tasks";

export const POST = route(
  async (request, { params }: RouteContext<"/api/boards/[boardId]/tasks">) => {
    const user = await requireSession();
    const { boardId } = await params;
    return Response.json(await createTask(user.id, boardId, await readJson(request)), {
      status: 201,
    });
  },
);

/** Bulk status change: `{ tasks: [{ id, status, position? }] }`. Returns the tasks that changed. */
export const PATCH = route(
  async (request, { params }: RouteContext<"/api/boards/[boardId]/tasks">) => {
    const user = await requireSession();
    const { boardId } = await params;
    return bulkMoveTasks(user.id, boardId, await readJson(request));
  },
);

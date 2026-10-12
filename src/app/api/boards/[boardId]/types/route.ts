import { readJson, requireSession, route } from "@/server/http";
import { createTaskType } from "@/server/services/task-types";

/** Owners add a task type `{ name, tone, isDefault? }`. */
export const POST = route(
  async (request, { params }: RouteContext<"/api/boards/[boardId]/types">) => {
    const user = await requireSession();
    const { boardId } = await params;
    return Response.json(await createTaskType(user.id, boardId, await readJson(request)), {
      status: 201,
    });
  },
);

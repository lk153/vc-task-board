import { readJson, requireSession, route } from "@/server/http";
import { createTask } from "@/server/services/tasks";

export const POST = route(
  async (request, { params }: RouteContext<"/api/boards/[boardId]/tasks">) => {
    const user = await requireSession();
    const { boardId } = await params;
    return Response.json(await createTask(user.id, boardId, await readJson(request)), {
      status: 201,
    });
  },
);

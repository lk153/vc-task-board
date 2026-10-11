import { readJson, requireSession, route } from "@/server/http";
import { createStatus } from "@/server/services/statuses";

/** Owners add a column `{ name, tone }`; it goes to the right of the others. */
export const POST = route(
  async (request, { params }: RouteContext<"/api/boards/[boardId]/statuses">) => {
    const user = await requireSession();
    const { boardId } = await params;
    return Response.json(await createStatus(user.id, boardId, await readJson(request)), {
      status: 201,
    });
  },
);

import { readJson, requireSession, route } from "@/server/http";
import { createPerson } from "@/server/services/people";

/** Owners add someone to the assignee list `{ name, tone }`. */
export const POST = route(
  async (request, { params }: RouteContext<"/api/boards/[boardId]/people">) => {
    const user = await requireSession();
    const { boardId } = await params;
    return Response.json(await createPerson(user.id, boardId, await readJson(request)), {
      status: 201,
    });
  },
);

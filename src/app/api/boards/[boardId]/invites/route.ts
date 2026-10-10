import { readJson, requireSession, route } from "@/server/http";
import { createInvite } from "@/server/services/invites";

/** Create (or renew) an invite for an email. The response holds the token for the link. */
export const POST = route(
  async (request, { params }: RouteContext<"/api/boards/[boardId]/invites">) => {
    const user = await requireSession();
    const { boardId } = await params;
    return Response.json(await createInvite(user.id, boardId, await readJson(request)), {
      status: 201,
    });
  },
);

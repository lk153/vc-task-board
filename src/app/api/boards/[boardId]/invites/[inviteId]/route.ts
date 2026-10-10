import { requireSession, route } from "@/server/http";
import { cancelInvite } from "@/server/services/invites";

export const DELETE = route(
  async (_request, { params }: RouteContext<"/api/boards/[boardId]/invites/[inviteId]">) => {
    const user = await requireSession();
    const { boardId, inviteId } = await params;
    await cancelInvite(user.id, boardId, inviteId);
  },
);

import { requireSession, route } from "@/server/http";
import { removeMember } from "@/server/services/members";

/** Owners remove a member; anyone can remove themselves (leave the board). */
export const DELETE = route(
  async (_request, { params }: RouteContext<"/api/boards/[boardId]/members/[userId]">) => {
    const user = await requireSession();
    const { boardId, userId } = await params;
    await removeMember(user.id, boardId, userId);
  },
);

import { requireSession, route } from "@/server/http";
import { acceptInvite } from "@/server/services/invites";

/** Join the board. Needs the secret token and a session with the invited email. */
export const POST = route(
  async (_request, { params }: RouteContext<"/api/invites/[token]/accept">) => {
    const user = await requireSession();
    const { token } = await params;
    return acceptInvite(user, token);
  },
);

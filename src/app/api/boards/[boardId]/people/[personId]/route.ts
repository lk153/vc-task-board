import { readJson, requireSession, route } from "@/server/http";
import { deletePerson, updatePerson } from "@/server/services/people";

type Context = RouteContext<"/api/boards/[boardId]/people/[personId]">;

/** Rename or recolor someone on the assignee list. */
export const PATCH = route(async (request, { params }: Context) => {
  const user = await requireSession();
  const { boardId, personId } = await params;
  return updatePerson(user.id, boardId, personId, await readJson(request));
});

/** Remove them from the list. Their tasks go to `?moveTo=<personId>`, or nobody. */
export const DELETE = route(async (request, { params }: Context) => {
  const user = await requireSession();
  const { boardId, personId } = await params;
  const moveTo = new URL(request.url).searchParams.get("moveTo");
  await deletePerson(user.id, boardId, personId, moveTo);
});

import { z } from "zod";
import { readJson, requireSession, route } from "@/server/http";
import { deleteBoard, getBoardView, renameBoard } from "@/server/services/boards";

type Context = RouteContext<"/api/boards/[boardId]">;

/** Board + members + tasks (+ pending invites for owners). */
export const GET = route(async (_request, { params }: Context) => {
  const user = await requireSession();
  const { boardId } = await params;
  return getBoardView(user.id, boardId);
});

export const PATCH = route(async (request, { params }: Context) => {
  const user = await requireSession();
  const { boardId } = await params;
  const { name } = z.object({ name: z.string() }).parse(await readJson(request));
  return renameBoard(user.id, boardId, name);
});

export const DELETE = route(async (_request, { params }: Context) => {
  const user = await requireSession();
  const { boardId } = await params;
  await deleteBoard(user.id, boardId);
});

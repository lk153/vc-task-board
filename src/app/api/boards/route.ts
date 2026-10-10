import { z } from "zod";
import { readJson, requireSession, route } from "@/server/http";
import { createBoard, listBoards } from "@/server/services/boards";

/** Boards I'm a member of. */
export const GET = route(async () => {
  const user = await requireSession();
  return listBoards(user.id);
});

/** Create a board; the creator becomes its owner. */
export const POST = route(async (request) => {
  const user = await requireSession();
  const { name } = z.object({ name: z.string() }).parse(await readJson(request));
  return Response.json(await createBoard(user.id, name), { status: 201 });
});

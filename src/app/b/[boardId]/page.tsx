import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { BoardSkeleton } from "@/components/board-skeleton";
import { BoardApp } from "@/features/board/board-app";
import { googleEnabled } from "@/server/config";
import { HttpError } from "@/server/errors";
import { getSessionUser } from "@/server/http";
import { listProviders } from "@/server/services/accounts";
import { getBoardView, listBoards } from "@/server/services/boards";

export default function BoardPage({ params }: PageProps<"/b/[boardId]">) {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <BoardLoader params={params} />
    </Suspense>
  );
}

/** Loads everything the board needs in one go, so the first HTML has the full board. */
async function BoardLoader({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/b/${boardId}`)}`);

  const view = await getBoardView(user.id, boardId).catch((error: unknown) => {
    // Non-members get the same 404 as a board that doesn't exist.
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  });
  const [boards, providers] = await Promise.all([listBoards(user.id), listProviders(user.id)]);

  return (
    <BoardApp
      key={boardId}
      initialView={view}
      initialBoards={boards}
      me={{ id: user.id, name: user.name, email: user.email, image: user.image ?? null }}
      providers={providers}
      googleEnabled={googleEnabled}
    />
  );
}

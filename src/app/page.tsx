import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BoardSkeleton } from "@/components/board-skeleton";
import { COOKIES } from "@/config/board";
import { getSessionUser } from "@/server/http";
import { resolveHomeBoard } from "@/server/services/boards";

/** `/` opens the last board you used, or your first board. */
export default function HomePage() {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <RedirectToBoard />
    </Suspense>
  );
}

async function RedirectToBoard(): Promise<never> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  const remembered = (await cookies()).get(COOKIES.lastBoard)?.value;
  redirect(`/b/${await resolveHomeBoard(user.id, remembered)}`);
}

"use client";

import { createContext, useContext } from "react";
import type { BoardSummary, BoardView, Member } from "@/domain/task";

export interface Me {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export interface BoardContextValue {
  boardId: string;
  view: BoardView;
  boards: BoardSummary[];
  me: Me;
  isOwner: boolean;
  membersById: Map<string, Member>;
  /** Sign-in methods on my account, e.g. ["credential", "google"]. */
  providers: string[];
  googleEnabled: boolean;
}

export const BoardContext = createContext<BoardContextValue | null>(null);

export function useBoardContext(): BoardContextValue {
  const value = useContext(BoardContext);
  if (!value) throw new Error("useBoardContext must be used inside <BoardApp>");
  return value;
}

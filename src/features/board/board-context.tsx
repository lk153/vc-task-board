"use client";

import { createContext, useContext } from "react";
import type {
  BoardPerson,
  BoardStatus,
  BoardSummary,
  BoardTaskType,
  BoardView,
} from "@/domain/task";
import { useUi } from "@/store/ui-store";

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
  /** Columns in order, and by id. */
  statuses: BoardStatus[];
  statusesById: Map<string, BoardStatus>;
  /** Where "New task" and N put new tasks. */
  defaultStatusId: string;
  /** Task types and assignees, by name, and by id. */
  types: BoardTaskType[];
  typesById: Map<string, BoardTaskType>;
  /** The type new tasks get (none if the board has no default). */
  defaultTypeId: string | null;
  people: BoardPerson[];
  peopleById: Map<string, BoardPerson>;
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

/** The column shown on mobile: the chosen tab if it still exists, else the default. */
export function useMobileStatusId(): string {
  const { statusesById, defaultStatusId } = useBoardContext();
  const chosen = useUi((s) => s.mobileStatus);
  return chosen && statusesById.has(chosen) ? chosen : defaultStatusId;
}

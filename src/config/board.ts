/**
 * Board vocabulary and tuning knobs. This is the only place to add a status,
 * priority, task type or color tone — types and validation derive from here.
 */

export const TONES = [
  "yellow",
  "gray",
  "blue",
  "orange",
  "green",
  "pink",
  "red",
  "lavender",
  "purple",
  "navy",
  "forest",
  "teal",
  "slate",
] as const;
export type Tone = (typeof TONES)[number];

export const STATUSES = [
  { id: "backlog", label: "Backlog", tone: "yellow" },
  { id: "todo", label: "To Do", tone: "gray" },
  { id: "progress", label: "In Progress", tone: "blue" },
  { id: "review", label: "In Review", tone: "orange" },
  { id: "done", label: "Done", tone: "green" },
] as const satisfies readonly { id: string; label: string; tone: Tone }[];

export const PRIORITIES = [
  { id: "low", label: "Low", tone: "slate", dot: "#8796ab" },
  { id: "medium", label: "Medium", tone: "green", dot: "#3fae5c" },
  { id: "high", label: "High", tone: "pink", dot: "#f07a7a" },
  { id: "critical", label: "Critical", tone: "red", dot: "#c8102e" },
] as const satisfies readonly { id: string; label: string; tone: Tone; dot: string }[];

export const TASK_TYPES = [
  { id: "tech", label: "Tech Solution", tone: "blue" },
  { id: "uiux", label: "UI/UX", tone: "lavender" },
  { id: "review", label: "Review Code", tone: "purple" },
  { id: "bug", label: "Bug", tone: "orange" },
  { id: "testing", label: "Testing", tone: "teal" },
  { id: "docs", label: "Documentation", tone: "gray" },
] as const satisfies readonly { id: string; label: string; tone: Tone }[];

/** Member tag colors, picked by a hash of the user id. */
export const ASSIGNEE_TONES = [
  "yellow",
  "navy",
  "forest",
  "lavender",
  "teal",
  "orange",
  "purple",
  "slate",
  "pink",
  "blue",
] as const satisfies readonly Tone[];

export const DEFAULT_STATUS = "todo";
export const DEFAULT_PRIORITY = "medium";
export const DEFAULT_TYPE = "tech";

/** Viewports narrower than this use the mobile layout. Keep in sync with `--breakpoint-desk` in globals.css. */
export const BREAKPOINT = 720;

export const TOAST_MS = { default: 2800, undo: 6000 } as const;

/** How often an open board refetches to pick up other members' changes. */
export const POLL_MS = 15_000;

export const INVITE_TTL_DAYS = 7;

export const LIMITS = {
  title: 200,
  description: 5000,
  boardName: 80,
  points: 999,
  email: 254,
  name: 80,
} as const;

/** Card display options (the design's `showDescription` / `compactCards` / `showStoryPoints`). */
export const DISPLAY = {
  showDescription: true,
  compactCards: false,
  showStoryPoints: true,
} as const;

export const COOKIES = {
  theme: "tb-theme",
  lastBoard: "tb-last-board",
} as const;

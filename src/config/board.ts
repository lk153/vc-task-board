/**
 * Board vocabulary and tuning knobs: priorities, task types, color tones and
 * limits — types and validation derive from here. Statuses (columns) are
 * per-board data that owners manage in the app; DEFAULT_STATUSES is only the
 * set a new board starts with.
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

/** Columns a new board starts with. "To Do" receives new tasks by default. */
export const DEFAULT_STATUSES = [
  { name: "Backlog", tone: "yellow", isDefault: false },
  { name: "To Do", tone: "gray", isDefault: true },
  { name: "In Progress", tone: "blue", isDefault: false },
  { name: "In Review", tone: "orange", isDefault: false },
  { name: "Done", tone: "green", isDefault: false },
] as const satisfies readonly { name: string; tone: Tone; isDefault: boolean }[];

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
  statusName: 40,
  /** Columns per board. */
  statuses: 15,
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

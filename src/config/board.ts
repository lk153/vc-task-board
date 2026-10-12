/**
 * Board vocabulary and tuning knobs: priorities, color tones and limits —
 * types and validation derive from here. Statuses (columns), task types and
 * assignees are per-board data that owners manage in the app; the DEFAULT_*
 * lists below are only what a new board starts with.
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

/** Task types a new board starts with. "Tech Solution" is given to new tasks by default. */
export const DEFAULT_TASK_TYPES = [
  { name: "Tech Solution", tone: "blue", isDefault: true },
  { name: "UI/UX", tone: "lavender", isDefault: false },
  { name: "Review Code", tone: "purple", isDefault: false },
  { name: "Bug", tone: "orange", isDefault: false },
  { name: "Testing", tone: "teal", isDefault: false },
  { name: "Documentation", tone: "gray", isDefault: false },
] as const satisfies readonly { name: string; tone: Tone; isDefault: boolean }[];

/** Avatar colors, and the color a member gets when added to a board's assignees (hash of the user id). */
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
  typeName: 40,
  /** Task types per board. */
  types: 30,
  personName: 80,
  /** Assignees per board. */
  people: 50,
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

"use client";

import { Filter, ListChecks, Plus, Search, Users, X } from "lucide-react";
import { DEFAULT_STATUS } from "@/config/board";
import { filterCount } from "@/domain/filter";
import { Button, IconButton } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/cn";
import { useUi } from "@/store/ui-store";
import { ThemeToggle } from "../account/theme-toggle";
import { UserMenu } from "../account/user-menu";
import { BoardSwitcher } from "../boards/board-switcher";

export const SEARCH_INPUT_ID = "board-search";

/**
 * One header for both layouts: below 720px the search box wraps onto its own
 * row and "New task" moves to the floating button.
 */
export function Header() {
  return (
    <header
      data-screen-label="Header"
      className="sticky top-0 z-20 flex flex-wrap items-center gap-x-2 gap-y-2.5 border-b border-line bg-header px-4 py-3 desk:px-6"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <Logo />
        <BoardSwitcher />
      </div>
      <SearchBox />
      <FilterButton />
      <SelectButton />
      <ShareButton />
      <ThemeToggle />
      <NewTaskButton />
      <UserMenu />
    </header>
  );
}

function SearchBox() {
  const query = useUi((s) => s.filters.query);
  const setQuery = useUi((s) => s.setQuery);
  return (
    <div className="relative order-last w-full desk:order-none desk:w-60">
      <Search
        aria-hidden
        size={15}
        strokeWidth={2}
        className="pointer-events-none absolute top-1/2 left-[11px] -translate-y-1/2 text-muted desk:left-2.5"
      />
      <input
        id={SEARCH_INPUT_ID}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && query) {
            event.stopPropagation();
            setQuery("");
          }
        }}
        placeholder="Search tasks"
        aria-label="Search tasks"
        aria-keyshortcuts="/"
        className="h-10 w-full rounded-lg border border-transparent bg-surface-2 pr-10 pl-[34px] text-[15px] text-fg outline-none focus:border-accent focus:bg-surface focus:shadow-focus desk:h-[34px] desk:rounded-md desk:pr-[30px] desk:pl-8 desk:text-[13.5px] [&::-webkit-search-cancel-button]:hidden"
      />
      {!query && (
        <kbd
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 font-sans text-[13px] text-muted opacity-70 desk:block"
        >
          /
        </kbd>
      )}
      {query && (
        <IconButton
          label="Clear search"
          size={24}
          onClick={() => setQuery("")}
          className="absolute top-1/2 right-[5px] -translate-y-1/2 max-desk:size-9!"
        >
          <X size={13} strokeWidth={2.2} />
        </IconButton>
      )}
    </div>
  );
}

function FilterButton() {
  const showFilters = useUi((s) => s.showFilters);
  const setShowFilters = useUi((s) => s.setShowFilters);
  const count = useUi((s) => filterCount(s.filters));
  return (
    <button
      type="button"
      onClick={() => setShowFilters(!showFilters)}
      aria-expanded={showFilters}
      aria-controls="board-filters"
      aria-label={count ? `Filters (${count} active)` : "Filters"}
      className={cn(
        "flex h-[34px] min-w-[34px] shrink-0 items-center justify-center gap-1.5 rounded-md border border-line-strong px-2.5 text-[13.5px] text-fg outline-none hover:bg-surface-2 focus-visible:shadow-focus",
        showFilters || count ? "bg-surface-2" : "bg-surface",
      )}
    >
      <Filter size={15} strokeWidth={1.9} aria-hidden />
      <span className="hidden desk:inline">Filter</span>
      {count > 0 && (
        <span className="grid h-[18px] min-w-[18px] place-items-center rounded-[9px] bg-accent px-[5px] text-[11px] font-semibold text-accent-fg">
          {count}
        </span>
      )}
    </button>
  );
}

/** Turns selection mode on and off (desktop shortcut: Ctrl/⌘-click or X on a card). */
function SelectButton() {
  const selecting = useUi((s) => s.selecting);
  const startSelecting = useUi((s) => s.startSelecting);
  const stopSelecting = useUi((s) => s.stopSelecting);
  return (
    <button
      type="button"
      onClick={() => (selecting ? stopSelecting() : startSelecting())}
      aria-pressed={selecting}
      aria-label="Select tasks"
      title="Select tasks (Ctrl/⌘-click or X on a card)"
      className={cn(
        "flex h-[34px] min-w-[34px] shrink-0 items-center justify-center gap-1.5 rounded-md border px-2.5 text-[13.5px] text-fg outline-none hover:bg-surface-2 focus-visible:shadow-focus",
        selecting ? "border-accent bg-surface-2" : "border-line-strong bg-surface",
      )}
    >
      <ListChecks size={15} strokeWidth={1.9} aria-hidden />
      <span className="hidden desk:inline">Select</span>
    </button>
  );
}

function ShareButton() {
  const openDialog = useUi((s) => s.openDialog);
  return (
    <button
      type="button"
      onClick={() => openDialog("share")}
      aria-label="Share board"
      className="flex h-[34px] min-w-[34px] shrink-0 items-center justify-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 text-[13.5px] text-fg outline-none hover:bg-surface-2 focus-visible:shadow-focus"
    >
      <Users size={15} strokeWidth={1.9} aria-hidden />
      <span className="hidden desk:inline">Share</span>
    </button>
  );
}

function NewTaskButton() {
  const openCreate = useUi((s) => s.openCreate);
  return (
    <Button
      variant="primary"
      size="md"
      onClick={() => openCreate(DEFAULT_STATUS)}
      title="New task (N)"
      aria-keyshortcuts="N"
      className="hidden pr-3.5 pl-[11px] desk:inline-flex"
    >
      <Plus size={15} strokeWidth={2.2} aria-hidden />
      New task
    </Button>
  );
}

"use client";

import { ChevronDown, Pencil } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { PRIORITIES, type Tone } from "@/config/board";
import { filterCount, UNASSIGNED } from "@/domain/filter";
import { MenuCheckboxItem, MenuItem, MenuPanel, MenuSeparator } from "@/components/ui/menu";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { useUi, type FilterGroup, type ListKind } from "@/store/ui-store";
import { useBoardContext } from "./board-context";

interface Option {
  id: string;
  label: string;
  tone: Tone;
}

/** Filter panel: one multi-select dropdown per group. OR within a group, AND across groups. */
export function FilterBar() {
  const { types, people, isOwner } = useBoardContext();
  const show = useUi((s) => s.showFilters);
  const filters = useUi((s) => s.filters);
  const clearAll = useUi((s) => s.clearFilters);
  if (!show) return null;

  const groups: {
    key: FilterGroup;
    label: string;
    allLabel: string;
    options: Option[];
    /** Owners can edit the list from its dropdown. */
    list?: { kind: ListKind; label: string };
  }[] = [
    { key: "priorities", label: "Priority", allLabel: "All priorities", options: [...PRIORITIES] },
    {
      key: "types",
      label: "Task type",
      allLabel: "All types",
      options: types.map((t) => ({ id: t.id, label: t.name, tone: t.tone })),
      list: { kind: "types", label: "Edit task types…" },
    },
    {
      key: "assignees",
      label: "Assignee",
      allLabel: "Anyone",
      options: [
        ...people.map((p) => ({ id: p.id, label: p.name, tone: p.tone })),
        { id: UNASSIGNED, label: "Unassigned", tone: "gray" as const },
      ],
      list: { kind: "people", label: "Edit assignees…" },
    },
  ];

  return (
    <div
      id="board-filters"
      data-screen-label="Filters"
      className="grid grid-cols-1 gap-3 border-b border-line bg-header px-4 pt-3 pb-3.5 desk:flex desk:flex-wrap desk:items-end desk:gap-x-4 desk:gap-y-3 desk:px-6 desk:pt-3.5 desk:pb-4"
    >
      {groups.map((group) => (
        <FilterDropdown
          key={group.key}
          group={group.key}
          label={group.label}
          allLabel={group.allLabel}
          options={group.options}
          selected={filters[group.key] as string[]}
          list={isOwner ? group.list : undefined}
        />
      ))}
      {filterCount(filters) > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className="h-[34px] justify-self-start rounded-md px-2 text-[13px] font-medium text-accent outline-none hover:bg-surface-2 focus-visible:shadow-focus"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

/** "All priorities", "High", "High, Low" or "High, Low +1". */
function summarize(options: Option[], selected: string[], allLabel: string) {
  const labels = options.filter((o) => selected.includes(o.id)).map((o) => o.label);
  if (labels.length === 0) return allLabel;
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
}

function FilterDropdown({
  group,
  label,
  allLabel,
  options,
  selected,
  list,
}: {
  group: FilterGroup;
  label: string;
  allLabel: string;
  options: Option[];
  selected: string[];
  list?: { kind: ListKind; label: string };
}) {
  const toggle = useUi((s) => s.toggleFilter);
  const clear = useUi((s) => s.clearFilterGroup);
  const openListDialog = useUi((s) => s.openListDialog);
  const active = selected.length > 0;
  const labelId = `filter-${group}-label`;
  const triggerId = `filter-${group}-trigger`;

  return (
    <div role="group" aria-labelledby={labelId} className="flex min-w-0 flex-col gap-1.5">
      <span id={labelId} className="text-xs font-medium text-muted">
        {label}
      </span>
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger
          id={triggerId}
          aria-labelledby={`${labelId} ${triggerId}`}
          className={cn(
            "flex h-[34px] w-full items-center gap-2 rounded-md border px-3 text-left text-[13.5px] outline-none focus-visible:shadow-focus data-[state=open]:border-accent desk:w-52",
            active
              ? "border-accent bg-surface-2 text-fg"
              : "border-line-strong bg-surface text-muted hover:bg-surface-2",
          )}
        >
          <span className="min-w-0 flex-1 truncate">{summarize(options, selected, allLabel)}</span>
          {active && (
            <span
              aria-hidden
              className="grid h-[18px] min-w-[18px] place-items-center rounded-[9px] bg-accent px-[5px] text-[11px] font-semibold text-accent-fg"
            >
              {selected.length}
            </span>
          )}
          <ChevronDown aria-hidden size={14} strokeWidth={2} className="shrink-0 text-muted" />
        </DropdownMenu.Trigger>
        <MenuPanel
          align="start"
          className="min-w-[max(13rem,var(--radix-dropdown-menu-trigger-width))]"
        >
          {options.length === 0 && <MenuItem disabled>None yet</MenuItem>}
          {options.map((option) => (
            <MenuCheckboxItem
              key={option.id || "unassigned"}
              checked={selected.includes(option.id)}
              onCheckedChange={() => toggle(group, option.id)}
            >
              <Tag tone={option.tone}>{option.label}</Tag>
            </MenuCheckboxItem>
          ))}
          {(active || list) && <MenuSeparator />}
          {active && (
            <MenuItem onSelect={() => clear(group)} className="text-accent">
              Clear {label.toLowerCase()} filter
            </MenuItem>
          )}
          {list && (
            <MenuItem onSelect={() => openListDialog(list.kind)}>
              <Pencil size={15} aria-hidden />
              {list.label}
            </MenuItem>
          )}
        </MenuPanel>
      </DropdownMenu.Root>
    </div>
  );
}

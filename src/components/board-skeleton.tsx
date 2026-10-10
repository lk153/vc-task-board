import { STATUSES } from "@/config/board";
import { Logo } from "@/components/ui/logo";

/** Static placeholder shown while the board streams in. */
export function BoardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading board" className="flex min-h-dvh flex-col bg-canvas">
      <div className="flex items-center gap-2.5 border-b border-line bg-header px-4 py-3 desk:px-6">
        <Logo />
        <div className="h-4 w-32 animate-pulse rounded bg-surface-3" />
        <span className="flex-1" />
        <div className="hidden h-[34px] w-60 animate-pulse rounded-md bg-surface-2 desk:block" />
        <div className="size-[34px] animate-pulse rounded-md bg-surface-2" />
        <div className="size-[34px] animate-pulse rounded-full bg-surface-2" />
      </div>
      <div className="flex flex-1 gap-3 overflow-hidden p-2 desk:p-4">
        {STATUSES.map((status, index) => (
          <div
            key={status.id}
            className={`flex flex-1 flex-col gap-2.5 p-2 desk:max-w-[340px] desk:min-w-[264px] desk:basis-0 ${index > 0 ? "max-desk:hidden" : ""}`}
          >
            <div className="h-6 w-24 animate-pulse rounded-[5px] bg-surface-3" />
            {Array.from({ length: 3 - (index % 2) }, (_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-lg border border-line bg-surface"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

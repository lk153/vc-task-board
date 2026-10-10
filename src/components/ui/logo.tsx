/** App mark from the design: a board with columns. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <div
      aria-hidden
      className="grid shrink-0 place-items-center rounded-[7px] bg-accent text-accent-fg"
      style={{ width: size, height: size }}
    >
      <svg
        width={size * 0.53}
        height={size * 0.53}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 3v18M15 3v12" />
      </svg>
    </div>
  );
}

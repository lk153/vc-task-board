import { assigneeTone, toneVars } from "@/domain/tone";
import { cn } from "@/lib/cn";

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts.at(-1)![0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

/** Round avatar: profile photo when available, otherwise initials in the member's tone. */
export function Avatar({
  userId,
  name,
  image,
  size = 28,
  className,
}: {
  userId: string;
  name: string;
  image?: string | null;
  size?: number;
  className?: string;
}) {
  const { bg, fg } = toneVars(assigneeTone(userId));
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold",
        className,
      )}
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.4 }}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny remote avatar, no optimization needed
        <img src={image} alt="" width={size} height={size} referrerPolicy="no-referrer" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

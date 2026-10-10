import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";

/** Centered card used by auth, invite, not-found and error pages. */
export function MessagePage({
  title,
  children,
  wide,
}: {
  title: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center bg-canvas px-4 py-10 desk:justify-center desk:py-16">
      <Link
        href="/"
        className="mb-6 flex items-center gap-2.5 text-fg no-underline hover:text-fg"
        aria-label="Task board home"
      >
        <Logo />
        <span className="text-base font-semibold tracking-[-0.01em]">Task board</span>
      </Link>
      <div
        className={`flex w-full flex-col gap-[18px] rounded-xl border border-line bg-surface p-6 shadow-card ${wide ? "max-w-[480px]" : "max-w-[400px]"}`}
      >
        <h1 className="m-0 text-lg font-semibold tracking-[-0.01em]">{title}</h1>
        {children}
      </div>
    </main>
  );
}

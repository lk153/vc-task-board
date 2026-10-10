import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { MessagePage } from "@/components/message-page";
import { JoinBoardButton, SwitchAccountButton } from "@/features/sharing/invite-actions";
import { getSessionUser } from "@/server/http";
import { isMember } from "@/server/services/access";
import { lookupInvite, maskEmail } from "@/server/services/invites";

export const metadata: Metadata = { title: "Board invite" };

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <Suspense
      fallback={
        <MessagePage title="Board invite">
          <p className="m-0 text-[13.5px] text-muted">Checking your invite…</p>
        </MessagePage>
      }
    >
      <Invite params={params} />
    </Suspense>
  );
}

const Text = ({ children }: { children: ReactNode }) => (
  <p className="m-0 text-[13.5px] leading-relaxed text-muted">{children}</p>
);

const ButtonLink = ({
  href,
  primary,
  children,
}: {
  href: string;
  primary?: boolean;
  children: ReactNode;
}) => (
  <Link
    href={href}
    className={
      primary
        ? "inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-[13.5px] font-medium text-accent-fg no-underline hover:bg-accent-hover hover:text-accent-fg"
        : "inline-flex h-10 items-center justify-center rounded-md border border-line-strong bg-surface px-4 text-[13.5px] font-medium text-fg no-underline hover:bg-surface-2 hover:text-fg"
    }
  >
    {children}
  </Link>
);

/** Explains what the link points at; joining needs the invited email (see acceptInvite). */
async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invite, user] = await Promise.all([lookupInvite(token), getSessionUser()]);
  const back = encodeURIComponent(`/invite/${token}`);

  if (invite.status === "not_found") {
    return (
      <MessagePage title="This invite link isn’t valid">
        <Text>It may have been cancelled or replaced. Ask the board owner for a new link.</Text>
        <ButtonLink href="/">Go to your boards</ButtonLink>
      </MessagePage>
    );
  }

  const board = <span className="font-medium text-fg">{invite.boardName}</span>;
  const inviter = invite.inviterName ?? "The board owner";

  if (user && (await isMember(user.id, invite.boardId))) {
    return (
      <MessagePage title="You’re a member of this board">
        <Text>You already have access to {board}.</Text>
        <ButtonLink href={`/b/${invite.boardId}`} primary>
          Open board
        </ButtonLink>
      </MessagePage>
    );
  }

  if (invite.status === "used") {
    return (
      <MessagePage title="This invite link has already been used">
        <Text>Each link works once. Ask {inviter} for a new one.</Text>
        <ButtonLink href="/">Go to your boards</ButtonLink>
      </MessagePage>
    );
  }

  if (invite.status === "expired") {
    return (
      <MessagePage title="This invite link has expired">
        <Text>
          Ask {inviter} to send you a new link to {board}.
        </Text>
        <ButtonLink href="/">Go to your boards</ButtonLink>
      </MessagePage>
    );
  }

  if (!user) {
    return (
      <MessagePage title={<>Join {invite.boardName}</>}>
        <Text>
          {inviter} invited you to {board}. Sign in or create an account with{" "}
          <span className="font-medium text-fg">{maskEmail(invite.email)}</span> to join.
        </Text>
        <div className="flex flex-col gap-2">
          <ButtonLink href={`/sign-in?next=${back}`} primary>
            Sign in
          </ButtonLink>
          <ButtonLink href={`/sign-up?next=${back}`}>Create an account</ButtonLink>
        </div>
      </MessagePage>
    );
  }

  if (user.email.toLowerCase() !== invite.email) {
    return (
      <MessagePage title="This invite is for another account">
        <Text>
          The invite is for <span className="font-medium text-fg">{maskEmail(invite.email)}</span>,
          but you’re signed in as <span className="font-medium text-fg">{user.email}</span>. Sign
          out, then sign in with the invited email.
        </Text>
        <SwitchAccountButton />
      </MessagePage>
    );
  }

  return (
    <MessagePage title={<>Join {invite.boardName}</>}>
      <Text>
        {inviter} invited you to {board}.
      </Text>
      <JoinBoardButton token={token} />
    </MessagePage>
  );
}

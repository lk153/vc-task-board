"use client";

import { Copy, Link2, UserMinus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { INVITE_TTL_DAYS } from "@/config/board";
import { inviteSchema, type Invite, type Member } from "@/domain/task";
import { Avatar } from "@/components/ui/avatar";
import { Button, IconButton } from "@/components/ui/button";
import { Field, FieldError, Input, Label } from "@/components/ui/field";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { ApiError } from "@/lib/api-client";
import { useUi } from "@/store/ui-store";
import { useCancelInvite, useCreateInvite, useRemoveMember } from "../board/api";
import { useBoardContext } from "../board/board-context";

export const inviteLink = (token: string) => `${window.location.origin}/invite/${token}`;

async function copyLink(token: string) {
  try {
    await navigator.clipboard.writeText(inviteLink(token));
    useUi.getState().showToast("Invite link copied");
  } catch {
    useUi.getState().showToast("Couldn't copy — select the link and copy it manually");
  }
}

function expiresIn(iso: string) {
  const days = Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
  return days <= 1 ? "Expires within a day" : `Expires in ${days} days`;
}

/**
 * Owners invite by email and copy the link to send themselves (the app sends
 * no email). Everyone sees the member list; members can leave.
 */
export function ShareDialog() {
  const open = useUi((s) => s.dialog === "share");
  const closeDialog = useUi((s) => s.closeDialog);
  const { view, isOwner } = useBoardContext();

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && closeDialog()}
      title={`Share “${view.board.name}”`}
    >
      {isOwner && <InviteForm />}
      {isOwner && view.invites.length > 0 && <PendingInvites invites={view.invites} />}
      <Members />
    </Modal>
  );
}

function InviteForm() {
  const { boardId } = useBoardContext();
  const createInvite = useCreateInvite(boardId);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Invite | null>(null);

  function submit() {
    const parsed = inviteSchema.safeParse({ email });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    createInvite.mutate(parsed.data.email, {
      onSuccess: (invite) => {
        setCreated(invite);
        setEmail("");
        setError(null);
      },
      onError: (err) =>
        setError(err instanceof ApiError ? err.message : "Couldn't create the invite."),
    });
  }

  return (
    <section className="flex flex-col gap-3" aria-label="Invite people">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex flex-col gap-1.5"
      >
        <Label htmlFor="invite-email">Invite by email</Label>
        <div className="flex gap-2">
          <Input
            id="invite-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={Boolean(error)}
            aria-describedby="invite-help"
            placeholder="name@company.com"
          />
          <Button
            variant="primary"
            type="submit"
            className="h-10"
            disabled={createInvite.isPending}
          >
            Create link
          </Button>
        </div>
        <FieldError>{error}</FieldError>
        <p id="invite-help" className="m-0 text-[12.5px] leading-normal text-muted">
          The app doesn’t send emails. Copy the link and send it yourself — they join by signing in
          with this email. Links work once and expire after {INVITE_TTL_DAYS} days.
        </p>
      </form>

      {created && (
        <Field className="rounded-lg border border-line bg-surface-2 p-3">
          <Label htmlFor="invite-link">Invite link for {created.email}</Label>
          <div className="flex gap-2">
            <Input
              id="invite-link"
              readOnly
              value={inviteLink(created.token)}
              onFocus={(e) => e.currentTarget.select()}
              className="font-mono text-[12.5px]"
            />
            <Button variant="secondary" className="h-10" onClick={() => copyLink(created.token)}>
              <Copy size={14} aria-hidden />
              Copy
            </Button>
          </div>
        </Field>
      )}
    </section>
  );
}

function PendingInvites({ invites }: { invites: Invite[] }) {
  const { boardId } = useBoardContext();
  const cancelInvite = useCancelInvite(boardId);
  return (
    <section aria-label="Pending invites" className="flex flex-col gap-2">
      <h3 className="m-0 text-[12.5px] font-medium text-muted">Pending invites</h3>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {invites.map((invite) => (
          <li key={invite.id} className="flex items-center gap-2.5 rounded-md py-1">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-muted">
              <Link2 size={14} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px]">{invite.email}</div>
              <div className="text-xs text-muted">{expiresIn(invite.expiresAt)}</div>
            </div>
            <IconButton
              label={`Copy invite link for ${invite.email}`}
              size={30}
              onClick={() => copyLink(invite.token)}
            >
              <Copy size={14} aria-hidden />
            </IconButton>
            <IconButton
              label={`Cancel invite for ${invite.email}`}
              size={30}
              onClick={() => cancelInvite.mutate(invite.id)}
            >
              <X size={15} aria-hidden />
            </IconButton>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Members() {
  const { view, boardId, me, isOwner } = useBoardContext();
  const removeMember = useRemoveMember(boardId);
  const router = useRouter();
  const [pending, setPending] = useState<{ member: Member; leaving: boolean } | null>(null);

  function confirm() {
    if (!pending) return;
    const { member, leaving } = pending;
    setPending(null);
    removeMember.mutate(member.userId, {
      onSuccess: () => {
        if (leaving) {
          useUi.getState().closeDialog();
          useUi.getState().showToast(`You left “${view.board.name}”`);
          router.replace("/");
        } else {
          useUi.getState().showToast(`${member.name} was removed from the board`);
        }
      },
    });
  }

  return (
    <section aria-label="Members" className="flex flex-col gap-2">
      <h3 className="m-0 text-[12.5px] font-medium text-muted">Members · {view.members.length}</h3>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {view.members.map((member) => {
          const isMe = member.userId === me.id;
          const canRemove = isOwner && !isMe && member.role !== "owner";
          const canLeave = isMe && member.role !== "owner";
          return (
            <li key={member.userId} className="flex items-center gap-2.5 py-1">
              <Avatar userId={member.userId} name={member.name} image={member.image} size={28} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px]">
                  {member.name}
                  {isMe && <span className="text-muted"> (you)</span>}
                </div>
                <div className="truncate text-xs text-muted">{member.email}</div>
              </div>
              <span className="text-xs text-muted">
                {member.role === "owner" ? "Owner" : "Member"}
              </span>
              {canRemove && (
                <IconButton
                  label={`Remove ${member.name}`}
                  size={30}
                  onClick={() => setPending({ member, leaving: false })}
                >
                  <UserMinus size={15} aria-hidden />
                </IconButton>
              )}
              {canLeave && (
                <Button
                  variant="dangerGhost"
                  size="sm"
                  onClick={() => setPending({ member, leaving: true })}
                >
                  Leave
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={Boolean(pending)}
        onCancel={() => setPending(null)}
        onConfirm={confirm}
        title={pending?.leaving ? "Leave this board?" : `Remove ${pending?.member.name}?`}
        description={
          pending?.leaving
            ? "You’ll lose access until an owner invites you again. Your tasks stay on the board, unassigned."
            : "They’ll lose access to this board. Their tasks stay on the board, unassigned."
        }
        confirmLabel={pending?.leaving ? "Leave board" : "Remove"}
        icon={<UserMinus size={17} />}
      />
    </section>
  );
}

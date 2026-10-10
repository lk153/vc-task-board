"use client";

import { KeyRound, LogOut } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { Avatar } from "@/components/ui/avatar";
import { GoogleIcon } from "@/components/ui/google-icon";
import { MenuItem, MenuPanel, MenuSeparator } from "@/components/ui/menu";
import { authClient } from "@/lib/auth-client";
import { useUi } from "@/store/ui-store";
import { useBoardContext } from "../board/board-context";

/** Avatar menu: who I am, connect Google, change password, sign out. */
export function UserMenu() {
  const { me, providers, googleEnabled } = useBoardContext();
  const openDialog = useUi((s) => s.openDialog);
  const showToast = useUi((s) => s.showToast);
  const hasPassword = providers.includes("credential");
  const canConnectGoogle = googleEnabled && !providers.includes("google");

  async function connectGoogle() {
    const { error } = await authClient.linkSocial({
      provider: "google",
      callbackURL: window.location.pathname,
    });
    if (error) showToast(error.message || "Couldn't connect Google. Try again.");
  }

  async function signOut() {
    await authClient.signOut();
    // Full page load, so no cached board data or prefetches outlive the session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/sign-in");
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label="Account menu"
        className="grid size-[34px] shrink-0 place-items-center rounded-full outline-none focus-visible:shadow-focus"
      >
        <Avatar userId={me.id} name={me.name} image={me.image} size={30} />
      </DropdownMenu.Trigger>
      <MenuPanel align="end" className="min-w-60">
        <div className="flex items-center gap-2.5 px-2.5 py-2">
          <Avatar userId={me.id} name={me.name} image={me.image} size={32} />
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-medium">{me.name}</div>
            <div className="truncate text-[12.5px] text-muted">{me.email}</div>
          </div>
        </div>
        <MenuSeparator />
        {canConnectGoogle && (
          <MenuItem onSelect={connectGoogle}>
            <GoogleIcon />
            Connect Google
          </MenuItem>
        )}
        {hasPassword && (
          <MenuItem onSelect={() => openDialog("changePassword")}>
            <KeyRound size={15} />
            Change password
          </MenuItem>
        )}
        <MenuItem onSelect={signOut}>
          <LogOut size={15} />
          Sign out
        </MenuItem>
      </MenuPanel>
    </DropdownMenu.Root>
  );
}

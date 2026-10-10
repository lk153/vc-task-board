import type { Metadata } from "next";
import { MessagePage } from "@/components/message-page";
import { SignInForm } from "@/features/auth/auth-forms";
import { googleEnabled } from "@/server/config";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <MessagePage title="Sign in">
      <SignInForm googleEnabled={googleEnabled} />
    </MessagePage>
  );
}

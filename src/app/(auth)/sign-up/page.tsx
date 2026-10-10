import type { Metadata } from "next";
import { MessagePage } from "@/components/message-page";
import { SignUpForm } from "@/features/auth/auth-forms";
import { googleEnabled } from "@/server/config";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <MessagePage title="Create your account">
      <SignUpForm googleEnabled={googleEnabled} />
    </MessagePage>
  );
}

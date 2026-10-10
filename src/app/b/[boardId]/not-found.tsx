import Link from "next/link";
import { MessagePage } from "@/components/message-page";

export default function BoardNotFound() {
  return (
    <MessagePage title="Board not found">
      <p className="m-0 text-[13.5px] leading-relaxed text-muted">
        This board doesn’t exist, or you’re not a member. Ask the board owner for an invite link.
      </p>
      <Link href="/" className="text-[13.5px] font-medium">
        Go to your boards
      </Link>
    </MessagePage>
  );
}

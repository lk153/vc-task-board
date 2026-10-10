import Link from "next/link";
import { MessagePage } from "@/components/message-page";

export default function NotFound() {
  return (
    <MessagePage title="Page not found">
      <p className="m-0 text-[13.5px] leading-relaxed text-muted">
        The page you’re looking for doesn’t exist.
      </p>
      <Link href="/" className="text-[13.5px] font-medium">
        Go to your boards
      </Link>
    </MessagePage>
  );
}

"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MessagePage } from "@/components/message-page";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <MessagePage title="Something went wrong">
      <p className="m-0 text-[13.5px] leading-relaxed text-muted">
        The page couldn’t load. Check your connection and try again.
      </p>
      <Button variant="primary" onClick={() => retry()} className="self-start">
        Try again
      </Button>
    </MessagePage>
  );
}

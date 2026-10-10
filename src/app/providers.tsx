"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api-client";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5_000,
            refetchOnWindowFocus: true,
            // Don't retry requests the server rejected on purpose (4xx).
            retry: (failures, error) =>
              !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
              failures < 2,
          },
          mutations: { retry: false },
        },
      }),
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

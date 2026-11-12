"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { ApiError, queryKeys } from "@/lib/api";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    // A 401 anywhere means the profile session ended: show the profile picker again.
    const onError = (error: Error) => {
      if (error instanceof ApiError && error.status === 401) {
        client.invalidateQueries({ queryKey: queryKeys.session });
      }
    };
    const client: QueryClient = new QueryClient({
      queryCache: new QueryCache({ onError }),
      mutationCache: new MutationCache({ onError }),
      defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 } },
    });
    return client;
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

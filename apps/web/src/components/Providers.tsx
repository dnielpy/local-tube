"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { ApiError, queryKeys } from "@/lib/api";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    // A 401 from any other request means the profile session ended: recheck the session so
    // the profile picker shows again. The session's own 401 must not trigger this, or
    // rechecking it answers 401 again and loops forever.
    const onError = (error: Error) => {
      if (error instanceof ApiError && error.status === 401) {
        client.invalidateQueries({ queryKey: queryKeys.session });
      }
    };
    const client: QueryClient = new QueryClient({
      queryCache: new QueryCache({
        onError: (error, query) => {
          if (query.queryKey[0] !== queryKeys.session[0]) onError(error);
        },
      }),
      mutationCache: new MutationCache({ onError }),
      defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 } },
    });
    return client;
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

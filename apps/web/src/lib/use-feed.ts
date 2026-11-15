"use client";

import { useQuery } from "@tanstack/react-query";

import { api, queryKeys } from "./api";

export function useFeed() {
  return useQuery({
    queryKey: queryKeys.feed,
    queryFn: api.feed,
    // The api refreshes the feed on its own every few hours; this picks that up.
    refetchInterval: (query) => (query.state.data?.refreshing ? 2000 : 5 * 60_000),
  });
}

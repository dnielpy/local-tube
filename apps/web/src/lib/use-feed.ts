"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, queryKeys } from "./api";

export function useFeed() {
  return useQuery({
    queryKey: queryKeys.feed,
    queryFn: api.feed,
    // The api refreshes the feed on its own every few hours; this picks that up.
    refetchInterval: (query) => (query.state.data?.refreshing ? 2000 : 5 * 60_000),
  });
}

export function useRefreshFeed() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.refreshFeed,
    onSuccess: (feed) => client.setQueryData(queryKeys.feed, feed),
  });
}

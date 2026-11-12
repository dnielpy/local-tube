import type { QueryClient } from "@tanstack/react-query";

import { api, queryKeys, type Profile } from "./api";

// Keep the session query itself: ProfileGate is subscribed to it, and clearing the whole cache
// would leave the gate watching a removed query that never updates.
const otherQueries = {
  predicate: (query: { queryKey: readonly unknown[] }) =>
    query.queryKey[0] !== queryKeys.session[0],
};

/** Shows the app for a profile that was just unlocked or created. */
export function openProfile(client: QueryClient, profile: Profile) {
  client.removeQueries(otherQueries);
  client.setQueryData(queryKeys.session, profile);
}

/** Ends the session and goes back to the profile picker. */
export async function closeProfile(client: QueryClient) {
  await api.logout().catch(() => undefined);
  client.removeQueries(otherQueries);
  await client.resetQueries({ queryKey: queryKeys.session });
}

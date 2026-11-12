import type { Metadata } from "next";
import { Suspense } from "react";

import { PlaylistsView } from "@/components/library/PlaylistsView";

export const metadata: Metadata = { title: "Listas de reproducción" };

export default function Page() {
  return (
    <Suspense>
      <PlaylistsView />
    </Suspense>
  );
}

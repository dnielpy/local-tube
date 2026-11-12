import { Suspense } from "react";

import { PlaylistView } from "@/components/library/PlaylistView";

export default function Page() {
  return (
    <Suspense>
      <PlaylistView />
    </Suspense>
  );
}

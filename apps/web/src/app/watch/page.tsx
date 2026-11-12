import { Suspense } from "react";

import { WatchView } from "@/components/WatchView";

export default function WatchPage() {
  return (
    <Suspense>
      <WatchView />
    </Suspense>
  );
}

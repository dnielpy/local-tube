import { Suspense } from "react";

import { SharedVideoSkeleton, SharedVideoView } from "@/components/SharedVideoView";

export default function ShareRoute() {
  return (
    <Suspense fallback={<SharedVideoSkeleton />}>
      <SharedVideoView />
    </Suspense>
  );
}

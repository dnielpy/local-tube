import { Suspense } from "react";

import { ChannelSkeleton, ChannelView } from "@/components/ChannelView";

export default function ChannelRoute() {
  return (
    <Suspense fallback={<ChannelSkeleton />}>
      <ChannelView />
    </Suspense>
  );
}

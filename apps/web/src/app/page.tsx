import { Suspense } from "react";

import { HomeFeed, HomeFeedSkeleton } from "@/components/HomeFeed";

export default function HomePage() {
  return (
    <Suspense fallback={<HomeFeedSkeleton />}>
      <HomeFeed />
    </Suspense>
  );
}

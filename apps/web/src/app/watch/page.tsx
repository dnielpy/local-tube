import { Suspense } from "react";

import { WatchView } from "@/components/WatchView";

export default function WatchPage() {
  return (
    <Suspense
      fallback={
        <div className="search:px-6 search:pt-6 watch:pr-[450px]">
          <div className="aspect-video w-full bg-black search:rounded-xl" />
        </div>
      }
    >
      <WatchView />
    </Suspense>
  );
}

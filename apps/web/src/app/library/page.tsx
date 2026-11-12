import type { Metadata } from "next";
import { Suspense } from "react";

import { LibraryView } from "@/components/library/LibraryView";

export const metadata: Metadata = { title: "Tú" };

export default function Page() {
  return (
    <Suspense>
      <LibraryView />
    </Suspense>
  );
}

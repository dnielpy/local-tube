import type { Metadata } from "next";
import { Suspense } from "react";

import { HistoryView } from "@/components/library/HistoryView";

export const metadata: Metadata = { title: "Historial" };

export default function Page() {
  return (
    <Suspense>
      <HistoryView />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";

import { Downloads } from "@/components/Downloads";

export const metadata: Metadata = { title: "Descargas" };

export default function DownloadsPage() {
  return (
    <Suspense>
      <Downloads />
    </Suspense>
  );
}

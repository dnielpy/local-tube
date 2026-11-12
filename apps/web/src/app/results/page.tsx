import type { Metadata } from "next";
import { Suspense } from "react";

import { SearchResults } from "@/components/SearchResults";

export const metadata: Metadata = { title: "Buscar" };

export default function ResultsPage() {
  return (
    <Suspense>
      <SearchResults />
    </Suspense>
  );
}

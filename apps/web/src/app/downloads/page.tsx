import type { Metadata } from "next";

import { Downloads } from "@/components/Downloads";

export const metadata: Metadata = { title: "Descargas" };

export default function DownloadsPage() {
  return <Downloads />;
}

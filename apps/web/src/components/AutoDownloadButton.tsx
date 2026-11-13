"use client";

import { useState } from "react";

import { useOnline } from "@/lib/use-status";

import { AutoDownloadDialog } from "./AutoDownloadDialog";
import { BoltIcon } from "./icons";
import { IconButton } from "./IconButton";

export function AutoDownloadButton() {
  const online = useOnline();
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton
        label={online ? "Buscar videos nuevos" : "Buscar videos nuevos (sin conexión)"}
        disabled={!online}
        onClick={() => setOpen(true)}
      >
        <BoltIcon />
      </IconButton>
      {open && <AutoDownloadDialog onClose={() => setOpen(false)} />}
    </>
  );
}

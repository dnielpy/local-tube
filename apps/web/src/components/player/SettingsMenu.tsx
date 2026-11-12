"use client";

import { useState } from "react";

import { BackIcon, CheckIcon, ChevronRightIcon, SpeedIcon } from "../icons";

const speedLabel = (rate: number) => (rate === 1 ? "Normal" : String(rate));

/** The gear popup: a main panel with the speed row and a nested speed list. */
export function SettingsMenu({
  open,
  rate,
  speeds,
  onRate,
  onClose,
}: {
  open: boolean;
  rate: number;
  speeds: number[];
  onRate: (rate: number) => void;
  onClose: () => void;
}) {
  const [panel, setPanel] = useState<"main" | "speed">("main");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setPanel("main");
  }
  if (!open) return null;

  return (
    <div
      className="absolute right-3 bottom-[61px] z-10 w-[251px] overflow-hidden rounded-xl bg-[rgba(28,28,28,0.9)] py-2 text-sm font-medium text-[#eee] shadow-lg"
      onKeyDown={(event) => event.key === "Escape" && onClose()}
    >
      {panel === "main" ? (
        <button
          type="button"
          onClick={() => setPanel("speed")}
          className="flex h-10 w-full items-center gap-3 px-4 hover:bg-white/10"
        >
          <SpeedIcon />
          <span className="flex-1 text-left">Velocidad de reproducción</span>
          <span className="font-normal">{speedLabel(rate)}</span>
          <ChevronRightIcon />
        </button>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => setPanel("main")}
            className="flex h-12 w-full items-center gap-3 border-b border-white/20 px-2 hover:bg-white/10"
          >
            <BackIcon />
            <span>Velocidad de reproducción</span>
          </button>
          <div className="max-h-[300px] overflow-y-auto pt-2">
            {speeds.map((speed) => (
              <button
                key={speed}
                type="button"
                role="menuitemradio"
                aria-checked={speed === rate}
                onClick={() => onRate(speed)}
                className="flex h-10 w-full items-center gap-3 px-4 font-normal hover:bg-white/10"
              >
                <span className="w-6">{speed === rate && <CheckIcon />}</span>
                {speedLabel(speed)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

const LENGTH = 4;

/** Four digit boxes that submit themselves once the last digit is typed. */
export function PinPad({
  onComplete,
  error,
  failures = 0,
  disabled,
  autoFocus = true,
}: {
  onComplete: (pin: string) => void;
  error?: string | null;
  /** Bump it after a wrong PIN to shake and clear the boxes. */
  failures?: number;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const [seenFailures, setSeenFailures] = useState(failures);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  if (failures !== seenFailures) {
    setSeenFailures(failures);
    setDigits(Array(LENGTH).fill(""));
  }

  useEffect(() => {
    if (failures) inputs.current[0]?.focus();
  }, [failures]);

  useEffect(() => {
    if (!disabled && autoFocus) inputs.current[digits.findIndex((digit) => !digit)]?.focus();
    // Only when the pad becomes usable again; typing moves the focus itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, autoFocus]);

  function fill(start: number, typed: string) {
    const clean = typed.replace(/\D/g, "");
    if (!clean) return;
    const next = [...digits];
    for (let i = 0; i < clean.length && start + i < LENGTH; i++) next[start + i] = clean[i];
    setDigits(next);
    const empty = next.findIndex((digit) => !digit);
    if (empty === -1) {
      inputs.current[LENGTH - 1]?.blur();
      onComplete(next.join(""));
    } else {
      inputs.current[empty]?.focus();
    }
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Backspace") return;
    event.preventDefault();
    const next = [...digits];
    const target = digits[index] ? index : Math.max(0, index - 1);
    next[target] = "";
    setDigits(next);
    inputs.current[target]?.focus();
  }

  return (
    <div>
      <div
        key={failures}
        className={`flex justify-center gap-3 ${failures ? "animate-[pin-shake_0.4s]" : ""}`}
      >
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              inputs.current[index] = element;
            }}
            value={digit ? "•" : ""}
            onChange={(event) => fill(index, event.target.value.replace("•", ""))}
            onKeyDown={(event) => onKeyDown(index, event)}
            onFocus={(event) => event.target.select()}
            disabled={disabled}
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label={`Dígito ${index + 1} del PIN`}
            className={`size-14 rounded-lg border-2 bg-transparent text-center text-3xl text-yt-text outline-none transition-colors focus:border-yt-text disabled:opacity-50 ${
              error ? "border-yt-error" : "border-yt-text-secondary"
            }`}
          />
        ))}
      </div>
      <p role="alert" className="mt-4 h-5 text-center text-sm text-yt-error">
        {error}
      </p>
    </div>
  );
}

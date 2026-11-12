import { readFileSync, writeFileSync } from "node:fs";

const path = process.argv[2];
const isDocLine = (line) => {
  const trimmed = line.trim();
  return trimmed.startsWith("/**") || trimmed.startsWith("*/") || trimmed.startsWith("* ") || trimmed === "*";
};
const lines = readFileSync(path, "utf8").split("\n").filter((line) => !isDocLine(line));
writeFileSync(path, lines.join("\n"));

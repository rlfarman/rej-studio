import { lstatSync } from "node:fs";

// Skip files under .claude/ (they're symlinks to .agents/ or local-only files
// that shouldn't go through project formatters). Also skip any symlinks.
const keep = (file) => {
  if (file.includes("/.claude/")) return false;
  try {
    if (lstatSync(file).isSymbolicLink()) return false;
  } catch {
    return false;
  }
  return true;
};

export default {
  "*.{js,jsx,ts,tsx,mjs,cjs}": (files) => {
    const filtered = files.filter(keep);
    if (filtered.length === 0) return [];
    return [
      `eslint --fix ${filtered.join(" ")}`,
      `prettier --write ${filtered.join(" ")}`,
    ];
  },
  "*.{json,md,css,yml,yaml}": (files) => {
    const filtered = files.filter(keep);
    if (filtered.length === 0) return [];
    return [`prettier --write ${filtered.join(" ")}`];
  },
};

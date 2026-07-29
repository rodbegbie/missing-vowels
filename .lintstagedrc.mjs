import path from "node:path";

export default {
  "frontend/src/**/*.{ts,tsx,css}": (files) => {
    const frontendDir = path.join(import.meta.dirname, "frontend");
    const relativePaths = files
      // lint-staged passes absolute paths; compute the real relative path
      // within frontend/ so a repo path that itself contains "frontend/"
      // above the project dir can't be mis-extracted.
      .map((file) => `"${path.relative(frontendDir, file)}"`)
      .join(" ");
    return `cd frontend && node_modules/.bin/biome check --write ${relativePaths}`;
  },
  "backend/*.py": [
    "backend/.venv/bin/ruff check",
    "backend/.venv/bin/ruff format",
    "backend/.venv/bin/ty check",
  ],
};

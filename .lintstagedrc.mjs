export default {
  'frontend/src/**/*.{ts,tsx,css}': (files) => {
    const relativePaths = files
      .map((file) => {
        // lint-staged passes absolute paths; extract the relative path within frontend/
        // e.g. '/path/to/repo/frontend/src/App.tsx' -> 'src/App.tsx'
        const match = file.match(/frontend\/(.+)$/);
        if (match) {
          return match[1];
        }
        // Fallback for relative paths (shouldn't happen but just in case)
        return file.replace(/^frontend\//, '');
      })
      .join(' ');
    // Use biome lint which properly blocks on errors and applies safe fixes
    return `cd frontend && node_modules/.bin/biome lint --write ${relativePaths}`;
  },
  'backend/*.py': [
    'backend/.venv/bin/ruff format',
    'backend/.venv/bin/ty check',
  ],
};

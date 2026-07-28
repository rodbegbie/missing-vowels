export default {
  'frontend/src/**/*.{ts,tsx,css}': (files) => {
    const relativePaths = files
      .map((file) => {
        // lint-staged passes absolute paths; extract the relative path within frontend/
        // e.g. '/path/to/repo/frontend/src/App.tsx' -> 'src/App.tsx'
        const match = file.match(/frontend\/(.+)$/);
        return match ? match[1] : file.replace(/^frontend\//, '');
      })
      .join(' ');
    // First lint (which blocks on errors), then format for safe fixes
    return [
      `cd frontend && node_modules/.bin/biome lint ${relativePaths}`,
      `cd frontend && node_modules/.bin/biome format --write ${relativePaths}`,
    ];
  },
  'backend/*.py': [
    'backend/.venv/bin/ruff format',
    'backend/.venv/bin/ty check',
  ],
};

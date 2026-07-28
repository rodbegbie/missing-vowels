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
    return `cd frontend && node_modules/.bin/biome check --write ${relativePaths}`;
  },
  'backend/*.py': [
    'backend/.venv/bin/ruff format',
    'backend/.venv/bin/ty check',
  ],
};

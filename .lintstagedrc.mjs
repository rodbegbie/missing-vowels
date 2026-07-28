export default {
  'frontend/src/**/*.{ts,tsx,css}': (files) => {
    const relativePaths = files
      .map((file) => {
        // files come in as git root-relative paths, need to convert to frontend-relative
        // e.g. 'frontend/src/App.tsx' -> 'src/App.tsx'
        return file.replace(/^frontend\//, '');
      })
      .join(' ');
    return `cd frontend && node_modules/.bin/biome check --write ${relativePaths}`;
  },
  'backend/*.py': [
    'backend/.venv/bin/ruff format',
    'backend/.venv/bin/ty check',
  ],
};

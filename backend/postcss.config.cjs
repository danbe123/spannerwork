// Backend tests do not need Tailwind or any CSS processing.
// This overrides the root PostCSS config so Vitest in the backend
// does not try to load Tailwind from the frontend.

module.exports = {
  plugins: [],
};

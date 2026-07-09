import { createTheme } from '@mantine/core';

// The visual design is driven mostly by src/styles.css tokens; this theme just aligns Mantine's
// primitives (fonts, radius, focus color) with that look. The app is rendered dark-only.
export const theme = createTheme({
  fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  fontFamilyMonospace: 'ui-monospace, Menlo, Monaco, monospace',
  primaryColor: 'blue',
  defaultRadius: 'md',
});

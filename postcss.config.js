// postcss.config.js
import tailwindcss from '@tailwindcss/postcss';  // Use the new PostCSS plugin
import autoprefixer from 'autoprefixer';

export default {
  plugins: [
    tailwindcss(),    // Initialize Tailwind CSS with the new plugin
    autoprefixer(),
  ]
};

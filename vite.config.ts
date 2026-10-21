import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // Stable libraries remain cached when application screens change.
        // Screen-level lazy imports keep the two workspaces independent.
        codeSplitting: {
          groups: [
            { name: 'react-runtime', test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/, priority: 20 },
            { name: 'supabase-client', test: /[\\/]node_modules[\\/]@supabase[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
});

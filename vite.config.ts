import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  server: {
    port: 5175,
    host: '0.0.0.0', // Set to 0.0.0.0 to bind to all local IPs so you can access it via your phone.
  }
});
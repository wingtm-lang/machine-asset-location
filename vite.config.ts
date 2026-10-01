import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  envPrefix: ['VITE_', 'GAS_'],
  define: {
    'process.env.GAS_URL': JSON.stringify(process.env.GAS_URL || process.env.VITE_GAS_URL || ''),
    'process.env.GAS_TOKEN': JSON.stringify(process.env.GAS_TOKEN || process.env.VITE_GAS_TOKEN || ''),
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
});

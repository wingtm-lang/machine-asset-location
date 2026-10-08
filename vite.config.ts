import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Hanya variabel berawalan VITE_ yang masuk ke bundle (default Vite).
// Jangan menambahkan secret key apa pun di sini.
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
  },
  preview: {
    port: port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});

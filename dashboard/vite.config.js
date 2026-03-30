import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return;
          }

          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
            return 'react-vendor';
          }

          if (id.includes('chart.js') || id.includes('react-chartjs-2')) {
            return 'charts';
          }

          if (id.includes('date-fns')) {
            return 'date-utils';
          }

          if (id.includes('lucide-react')) {
            return 'icons';
          }

          if (id.includes('axios') || id.includes('react-toastify')) {
            return 'app-vendor';
          }
        },
      },
    },
  },
})

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      '/service-health/account': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        rewrite: () => '/actuator/health',
      },
      '/service-health/transaction': {
        target: 'http://localhost:8082',
        changeOrigin: true,
        rewrite: () => '/actuator/health',
      },
      '/service-health/payment': {
        target: 'http://localhost:8083',
        changeOrigin: true,
        rewrite: () => '/actuator/health',
      },
      '/service-health/fraud': {
        target: 'http://localhost:8084',
        changeOrigin: true,
        rewrite: () => '/actuator/health',
      },
      '/service-health/notification': {
        target: 'http://localhost:8085',
        changeOrigin: true,
        rewrite: () => '/actuator/health',
      },
      '/service-health/gateway': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: () => '/actuator/health',
      },
    },
  },
});

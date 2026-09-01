import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['html2pdf.js', 'jszip', 'pdf-lib', 'pdfjs-dist'],
  },
})

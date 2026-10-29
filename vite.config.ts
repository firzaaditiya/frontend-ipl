import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Port API diambil dari satu sumber kebenaran: server_port di config backend.
// FIM_API_PORT boleh menimpanya (mis. saat backend dijalankan dengan config lain).
function resolveApiPort(env: Record<string, string>): number {
  const override = env.FIM_API_PORT
  if (override && /^\d+$/.test(override)) return Number(override)

  const configPath = fileURLToPath(
    new URL('../backend/data/config.json', import.meta.url),
  )
  try {
    const cfg = JSON.parse(readFileSync(configPath, 'utf8')) as { server_port?: string }
    const match = /(\d+)$/.exec(cfg.server_port ?? '')
    if (match) return Number(match[1])
  } catch {
    // Config belum ada (mis. checkout baru): pakai default backend.
  }
  return 8080
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = resolveApiPort(env)

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 3000,
      strictPort: true,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
  }
})

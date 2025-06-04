import { resolve } from 'node:path'
import devServer from '@hono/vite-dev-server'
import type { UserConfig } from 'vite'
import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig((): UserConfig => {
  return {
    resolve: {
      alias: {
        '~': resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 9981,
    },
    plugins: [
      devServer({
        entry: 'src/server.ts',
      }),
      viteStaticCopy({
        targets: [
          {
            src: ['./wrangler.raw.toml'],
            dest: '../',
            rename: 'wrangler.toml',
          },
          {
            src: './src/sql/migrations',
            dest: '../src/sql',
          },
        ],
      }),
    ],
  }
})

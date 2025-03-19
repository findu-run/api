import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  outDir: 'dist',
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  format: ['cjs'],
  target: 'node18',
  shims: true,
  dts: true, // Gera arquivos de definição de tipos (.d.ts)
  esbuildOptions(options) {
    options.resolveExtensions = ['.ts', '.js']
  },
})
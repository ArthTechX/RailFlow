import { defineConfig } from 'vitest/config';
export default defineConfig({test:{setupFiles:['tests/env.ts'],testTimeout:30000,exclude:['node_modules/**','dist/**'],fileParallelism:false}});

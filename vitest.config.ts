import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/tests/**',
        'vitest.config.ts',
        'src/cli.ts', // CLI entry point
        'src/server.ts', // MCP server entry point
      ],
      include: [
        'src/**/*.ts'
      ],
      all: true,
      lines: 70,
      functions: 70,
      branches: 70,
      statements: 70
    },
    testTimeout: 30000,
    hookTimeout: 30000
  }
});


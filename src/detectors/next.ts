import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'glob';

export async function findNextRoutes(repoPath: string): Promise<string[]> {
  const routes: string[] = [];

  try {
    // Next.js 13+ app directory
    const appPages = await glob('**/app/**/page.{tsx,ts,jsx,js}', {
      cwd: repoPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**']
    });

    for (const page of appPages) {
      // Converte app/auth/login/page.tsx -> /auth/login
      const route = page
        .replace(/^.*?app/, '')
        .replace(/\/page\.(tsx|ts|jsx|js)$/, '')
        .replace(/\\/g, '/')
        || '/';
      routes.push(route);
    }

    // Next.js pages directory (fallback)
    const pagesFiles = await glob('**/pages/**/*.{tsx,ts,jsx,js}', {
      cwd: repoPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/_app.*', '**/_document.*']
    });

    for (const page of pagesFiles) {
      const route = page
        .replace(/^.*?pages/, '')
        .replace(/\.(tsx|ts|jsx|js)$/, '')
        .replace(/\/index$/, '')
        .replace(/\[([^\]]+)\]/g, ':$1')
        .replace(/\\/g, '/')
        || '/';
      routes.push(route);
    }
  } catch (error) {
    console.warn('Erro ao detectar rotas Next.js:', error);
  }

  return [...new Set(routes)].sort();
}


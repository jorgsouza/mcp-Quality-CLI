import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'glob';

export interface Endpoint {
  method: string;
  path: string;
  file: string;
}

export async function findExpressRoutes(repoPath: string): Promise<Endpoint[]> {
  const endpoints: Endpoint[] = [];

  try {
    const routeFiles = await glob('**/*.{ts,js}', {
      cwd: repoPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/test/**', '**/tests/**']
    });

    for (const file of routeFiles) {
      const content = await fs.readFile(join(repoPath, file), 'utf8');
      
      // Detecta rotas Express/Fastify
      const routeRegex = /(?:router|app|server)\.(get|post|put|patch|delete|options)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
      let match;

      while ((match = routeRegex.exec(content)) !== null) {
        endpoints.push({
          method: match[1].toUpperCase(),
          path: match[2],
          file
        });
      }
    }
  } catch (error) {
    console.warn('Erro ao detectar rotas Express:', error);
  }

  return endpoints;
}

export async function findOpenAPI(repoPath: string): Promise<string[]> {
  const specs: string[] = [];

  try {
    const openApiFiles = await glob('**/openapi*.{yml,yaml,json}', {
      cwd: repoPath,
      ignore: ['**/node_modules/**', '**/dist/**']
    });

    specs.push(...openApiFiles);

    const swaggerFiles = await glob('**/swagger*.{yml,yaml,json}', {
      cwd: repoPath,
      ignore: ['**/node_modules/**', '**/dist/**']
    });

    specs.push(...swaggerFiles);
  } catch (error) {
    console.warn('Erro ao detectar OpenAPI:', error);
  }

  return [...new Set(specs)];
}


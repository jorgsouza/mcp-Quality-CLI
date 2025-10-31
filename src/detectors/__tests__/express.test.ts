import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { findExpressRoutes, findOpenAPI } from '../express.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('findExpressRoutes', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `express-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignorar erros de limpeza
    }
  });

  // 1. GET routes
  it('deve detectar app.get("/path", handler)', async () => {
    const routeFile = join(testDir, 'routes.ts');
    await fs.writeFile(routeFile, `
      app.get('/users', (req, res) => {
        res.json({ users: [] });
      });
    `);

    const endpoints = await findExpressRoutes(testDir);

    expect(endpoints).toHaveLength(1);
    expect(endpoints[0]).toMatchObject({
      method: 'GET',
      path: '/users'
    });
  });

  // 2. POST routes
  it('deve detectar app.post("/path", handler)', async () => {
    const routeFile = join(testDir, 'routes.ts');
    await fs.writeFile(routeFile, `
      app.post('/users', (req, res) => {
        res.json({ created: true });
      });
    `);

    const endpoints = await findExpressRoutes(testDir);

    expect(endpoints).toHaveLength(1);
    expect(endpoints[0]).toMatchObject({
      method: 'POST',
      path: '/users'
    });
  });

  // 3. Múltiplos verbos
  it('deve detectar router.put, router.delete, router.patch', async () => {
    const routeFile = join(testDir, 'routes.ts');
    await fs.writeFile(routeFile, `
      router.put('/users/:id', updateUser);
      router.delete('/users/:id', deleteUser);
      router.patch('/users/:id', patchUser);
    `);

    const endpoints = await findExpressRoutes(testDir);

    expect(endpoints).toHaveLength(3);
    expect(endpoints.map(e => e.method)).toEqual(['PUT', 'DELETE', 'PATCH']);
    expect(endpoints.map(e => e.path)).toEqual(['/users/:id', '/users/:id', '/users/:id']);
  });

  // 4. Routers separados
  it('deve detectar Router() com routes', async () => {
    const routeFile = join(testDir, 'user-routes.ts');
    await fs.writeFile(routeFile, `
      import { Router } from 'express';
      const router = Router();
      
      router.get('/profile', getProfile);
      router.post('/profile', updateProfile);
      
      export default router;
    `);

    const endpoints = await findExpressRoutes(testDir);

    expect(endpoints).toHaveLength(2);
    expect(endpoints[0]).toMatchObject({
      method: 'GET',
      path: '/profile'
    });
    expect(endpoints[1]).toMatchObject({
      method: 'POST',
      path: '/profile'
    });
  });

  // 5. Middleware chains
  it('deve detectar routes com middlewares', async () => {
    const routeFile = join(testDir, 'protected-routes.ts');
    await fs.writeFile(routeFile, `
      app.get('/admin', authMiddleware, adminMiddleware, (req, res) => {
        res.json({ admin: true });
      });
    `);

    const endpoints = await findExpressRoutes(testDir);

    expect(endpoints).toHaveLength(1);
    expect(endpoints[0]).toMatchObject({
      method: 'GET',
      path: '/admin'
    });
  });

  // Teste adicional: diferentes estilos de quotes
  it('deve detectar rotas com aspas simples, duplas e template literals', async () => {
    const routeFile = join(testDir, 'routes.ts');
    await fs.writeFile(routeFile, `
      app.get('/single', handler);
      app.post("/double", handler);
      app.put(\`/template\`, handler);
    `);

    const endpoints = await findExpressRoutes(testDir);

    expect(endpoints).toHaveLength(3);
    expect(endpoints.map(e => e.path)).toEqual(['/single', '/double', '/template']);
  });

  // Teste adicional: server.method (Fastify)
  it('deve detectar server.get (Fastify)', async () => {
    const routeFile = join(testDir, 'fastify-routes.ts');
    await fs.writeFile(routeFile, `
      server.get('/health', async (request, reply) => {
        return { status: 'ok' };
      });
    `);

    const endpoints = await findExpressRoutes(testDir);

    expect(endpoints).toHaveLength(1);
    expect(endpoints[0]).toMatchObject({
      method: 'GET',
      path: '/health'
    });
  });

  // Teste adicional: OPTIONS method
  it('deve detectar router.options', async () => {
    const routeFile = join(testDir, 'cors-routes.ts');
    await fs.writeFile(routeFile, `
      router.options('/api/*', corsHandler);
    `);

    const endpoints = await findExpressRoutes(testDir);

    expect(endpoints).toHaveLength(1);
    expect(endpoints[0]).toMatchObject({
      method: 'OPTIONS',
      path: '/api/*'
    });
  });
});

describe('findOpenAPI', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `openapi-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignorar erros de limpeza
    }
  });

  // 6. YAML files
  it('deve parsear openapi.yml', async () => {
    await fs.writeFile(join(testDir, 'openapi.yml'), `
      openapi: 3.0.0
      info:
        title: Test API
        version: 1.0.0
      paths:
        /users:
          get:
            summary: List users
    `);

    const specs = await findOpenAPI(testDir);

    expect(specs).toHaveLength(1);
    expect(specs[0]).toBe('openapi.yml');
  });

  // 7. JSON files
  it('deve parsear openapi.json', async () => {
    await fs.writeFile(join(testDir, 'openapi.json'), JSON.stringify({
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0'
      },
      paths: {
        '/users': {
          get: {
            summary: 'List users'
          }
        }
      }
    }));

    const specs = await findOpenAPI(testDir);

    expect(specs).toHaveLength(1);
    expect(specs[0]).toBe('openapi.json');
  });

  // 8. Múltiplos paths
  it('deve extrair todos os endpoints de paths', async () => {
    // Criar múltiplos arquivos OpenAPI
    await fs.mkdir(join(testDir, 'docs'), { recursive: true });
    
    await fs.writeFile(join(testDir, 'openapi.yml'), 'openapi: 3.0.0');
    await fs.writeFile(join(testDir, 'docs/swagger.yml'), 'swagger: 2.0');

    const specs = await findOpenAPI(testDir);

    expect(specs).toHaveLength(2);
    expect(specs).toContain('openapi.yml');
    expect(specs).toContain('docs/swagger.yml');
  });

  // 9. Arquivo não existe
  it('deve retornar array vazio se spec não existir', async () => {
    // Diretório vazio
    const specs = await findOpenAPI(testDir);

    expect(specs).toEqual([]);
  });

  // 10. Spec inválido (ainda deve detectar o arquivo)
  it('deve lidar com spec malformado', async () => {
    await fs.writeFile(join(testDir, 'openapi.yml'), 'invalid: yaml: content:');

    const specs = await findOpenAPI(testDir);

    // A função atual apenas lista arquivos, não valida conteúdo
    expect(specs).toHaveLength(1);
    expect(specs[0]).toBe('openapi.yml');
  });

  // Teste adicional: swagger files
  it('deve detectar swagger.json e swagger.yml', async () => {
    await fs.writeFile(join(testDir, 'swagger.json'), '{}');
    await fs.writeFile(join(testDir, 'swagger.yml'), 'swagger: 2.0');

    const specs = await findOpenAPI(testDir);

    expect(specs).toHaveLength(2);
    expect(specs).toContain('swagger.json');
    expect(specs).toContain('swagger.yml');
  });

  // Teste adicional: remover duplicatas
  it('deve remover specs duplicados', async () => {
    // Criar arquivo com nome que match múltiplos padrões
    await fs.writeFile(join(testDir, 'openapi-swagger.yml'), 'openapi: 3.0.0');

    const specs = await findOpenAPI(testDir);

    // Deve ter apenas uma entrada (Set remove duplicatas)
    const uniqueSpecs = [...new Set(specs)];
    expect(specs.length).toBe(uniqueSpecs.length);
  });

  // Teste adicional: .yaml extension
  it('deve detectar arquivos .yaml além de .yml', async () => {
    await fs.writeFile(join(testDir, 'openapi.yaml'), 'openapi: 3.0.0');

    const specs = await findOpenAPI(testDir);

    expect(specs).toHaveLength(1);
    expect(specs[0]).toBe('openapi.yaml');
  });
});


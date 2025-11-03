import { join } from 'node:path';
import { writeFileSafe, ensureDir, readFile, fileExists } from '../utils/fs.js';
import { loadMCPSettings, mergeSettings } from '../utils/config.js';
import { findExpressRoutes, findOpenAPI, type Endpoint } from '../detectors/express.js';
import { getPaths, ensurePaths } from '../utils/paths.js';
import { getLanguageAdapter } from '../adapters/index.js';

export interface ScaffoldIntegrationParams {
  repo: string;
  product?: string;
  base_url?: string;
  endpoints?: string[];  // Endpoints específicos ou auto-detect
}

export async function scaffoldIntegrationTests(input: ScaffoldIntegrationParams): Promise<{
  ok: boolean;
  test_dir: string;
  generated: string[];
}> {
  // Carrega e mescla configurações
  const fileSettings = await loadMCPSettings(input.repo, input.product);
  const settings = mergeSettings(fileSettings, input);

  console.log(`🔗 Gerando testes de integração para ${settings.product}...`);

  // [FASE 2] Calcular e garantir paths
  const paths = getPaths(settings.repo, settings.product || 'default', fileSettings || undefined);
  await ensurePaths(paths);

  // Valida base_url se fornecida
  if (settings.base_url && settings.base_url !== '') {
    try {
      new URL(settings.base_url);
    } catch (error) {
      throw new Error(`URL inválida: ${settings.base_url}`);
    }
  }

  // [FASE 2] Usar paths.integration
  const testDir = paths.integration;

  // Detecta endpoints
  let endpoints: Endpoint[] = [];
  if (input.endpoints && input.endpoints.length > 0) {
    // Usa endpoints específicos se fornecidos
    endpoints = input.endpoints.map(path => ({
      method: 'GET',
      path,
      handler: '',
      file: '',
      line: 0
    }));
  } else {
    // Auto-detecta endpoints
    endpoints = await findExpressRoutes(input.repo);
  }
  
  const openApiSpecs = await findOpenAPI(input.repo);

  const generated: string[] = [];

  // Se não há endpoints, não gera nada
  if (endpoints.length === 0 && input.endpoints !== undefined) {
    return {
      ok: true,
      test_dir: testDir,
      generated: []
    };
  }

  // Gera configuração base
  await generateIntegrationSetup(input.repo, testDir, settings.base_url);
  generated.push('tests/integration/setup.ts');

  // Gera helpers
  await generateTestHelpers(testDir);
  generated.push('tests/integration/helpers/api-client.ts');

  // Gera helpers avançados (Supertest + Testcontainers)
  await generateAdvancedHelpers(testDir);
  generated.push('tests/integration/helpers/supertest-client.ts');
  generated.push('tests/integration/helpers/testcontainers.ts');

  // Gera exemplos práticos de uso
  await generateAdvancedExamples(testDir);
  generated.push('tests/integration/examples/supertest.example.test.ts');
  generated.push('tests/integration/examples/testcontainers.example.test.ts');

  // [ADAPTER PATTERN] Detecta linguagem e usa adapter apropriado
  const adapter = await getLanguageAdapter(input.repo);
  console.log(`📦 Linguagem detectada: ${adapter.language} (${adapter.defaultFramework})`);

  // Gera testes por domínio
  const endpointsByDomain = groupEndpointsByDomain(endpoints);
  
  for (const [domain, domainEndpoints] of Object.entries(endpointsByDomain)) {
    const testFile = await generateDomainIntegrationTests(
      testDir,
      domain,
      domainEndpoints,
      settings.base_url,
      adapter  // ← Passa adapter
    );
    generated.push(testFile);
  }

  // Se tem endpoints, sempre gera testes de contrato
  if (endpoints.length > 0) {
    if (openApiSpecs.length > 0) {
      await generateContractTests(testDir, openApiSpecs[0], input.repo);
    } else {
      await generateBasicContractTests(testDir, endpoints);
    }
    generated.push('tests/integration/contract/api-contract.test.ts');
  }

  // Gera guia
  await generateIntegrationGuide(paths.reports, settings.product || 'Product');
  // [FASE 2] Usar path relativo ao root
  generated.push('tests/reports/INTEGRATION-TESTING-GUIDE.md');

  // Atualiza package.json com scripts de integração
  await updatePackageJsonWithIntegrationScripts(input.repo);

  console.log(`✅ ${generated.length} arquivos de testes de integração gerados!`);

  return {
    ok: true,
    test_dir: testDir,
    generated
  };
}

async function generateIntegrationSetup(repoPath: string, testDir: string, baseUrl?: string) {
  const setup = `import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { setupServer } from './helpers/test-server';
import { cleanDatabase } from './helpers/database';

// Base URL para testes
export const BASE_URL = process.env.API_BASE_URL || '${baseUrl || 'http://localhost:3000'}';

// Setup global para todos os testes de integração
beforeAll(async () => {
  console.log('🚀 Iniciando testes de integração...');
  
  // Inicia servidor de testes se necessário
  if (process.env.START_TEST_SERVER === 'true') {
    await setupServer();
  }
});

afterAll(async () => {
  console.log('✅ Testes de integração finalizados');
  
  // Cleanup
  if (process.env.START_TEST_SERVER === 'true') {
    // await stopServer();
  }
});

beforeEach(async () => {
  // Limpa dados antes de cada teste (opcional)
  if (process.env.CLEAN_DB_EACH_TEST === 'true') {
    await cleanDatabase();
  }
});

afterEach(async () => {
  // Cleanup after each test
});
`;

  await writeFileSafe(join(testDir, 'setup.ts'), setup);
}

async function generateTestHelpers(testDir: string) {
  await ensureDir(join(testDir, 'helpers'));

  // API Client helper
  const apiClient = `import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { BASE_URL } from '../setup';

export class ApiClient {
  private client: AxiosInstance;
  private authToken?: string;

  constructor(baseURL: string = BASE_URL) {
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Interceptor para adicionar token
    this.client.interceptors.request.use((config) => {
      if (this.authToken) {
        config.headers.Authorization = \`Bearer \${this.authToken}\`;
      }
      return config;
    });
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig) {
    const response = await this.client.get<T>(url, config);
    return response;
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    const response = await this.client.post<T>(url, data, config);
    return response;
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    const response = await this.client.put<T>(url, data, config);
    return response;
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    const response = await this.client.patch<T>(url, data, config);
    return response;
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig) {
    const response = await this.client.delete<T>(url, config);
    return response;
  }
}

// Instância compartilhada
export const api = new ApiClient();
`;

  await writeFileSafe(join(testDir, 'helpers', 'api-client.ts'), apiClient);

  // Database helper
  const database = `// Helpers para limpar banco de dados nos testes
export async function cleanDatabase() {
  // TODO: Implementar limpeza do banco
  // Exemplo com Prisma:
  // await prisma.user.deleteMany();
  // await prisma.post.deleteMany();
}

export async function seedDatabase() {
  // TODO: Implementar seed de dados para testes
}

export async function createTestUser() {
  // TODO: Criar usuário de teste
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User'
  };
}
`;

  await writeFileSafe(join(testDir, 'helpers', 'database.ts'), database);

  // Test server helper
  const testServer = `// Helper para iniciar servidor nos testes
export async function setupServer() {
  // TODO: Implementar inicialização do servidor
  console.log('Server setup');
}

export async function stopServer() {
  // TODO: Implementar parada do servidor
  console.log('Server stopped');
}
`;

  await writeFileSafe(join(testDir, 'helpers', 'test-server.ts'), testServer);
}

function groupEndpointsByDomain(endpoints: Endpoint[]): Record<string, Endpoint[]> {
  const groups: Record<string, Endpoint[]> = {};

  for (const endpoint of endpoints) {
    // Extrai domínio do path: /api/users -> users, /api/posts -> posts
    const parts = endpoint.path.split('/').filter(p => p && p !== 'api');
    const domain = parts[0] || 'general';

    if (!groups[domain]) {
      groups[domain] = [];
    }
    groups[domain].push(endpoint);
  }

  return groups;
}

async function generateDomainIntegrationTests(
  testDir: string,
  domain: string,
  endpoints: Endpoint[],
  baseUrl?: string,
  adapter?: any  // Novo parâmetro opcional
): Promise<string> {
  const domainDir = join(testDir, domain);
  await ensureDir(domainDir);

  // [ADAPTER PATTERN] Se adapter foi passado, usa generateIntegrationTest
  if (adapter) {
    const content = adapter.generateIntegrationTest(domain, {
      includeImports: true,
      includeComments: true
    });
    
    const extension = adapter.getTestFileExtension();
    const testFile = join(domainDir, `${domain}${extension}`);
    await writeFileSafe(testFile, content);
    
    return `tests/integration/${domain}/${domain}${extension}`;
  }

  // Fallback para template TypeScript (compatibilidade)
  const testCases = endpoints.map(endpoint => 
    generateEndpointTest(endpoint)
  ).join('\n\n');

  const content = `import { describe, it, expect, beforeAll } from 'vitest';
import { api } from '../helpers/api-client';
import { createTestUser } from '../helpers/database';

describe('${domain.toUpperCase()} API', () => {
  beforeAll(async () => {
    // Setup para testes do domínio ${domain}
    // const user = await createTestUser();
    // const token = await login(user);
    // api.setAuthToken(token);
  });

${testCases}
});
`;

  const testFile = join(domainDir, `${domain}.test.ts`);
  await writeFileSafe(testFile, content);
  
  return `tests/integration/${domain}/${domain}.test.ts`;
}

function generateEndpointTest(endpoint: Endpoint): string {
  const { method, path } = endpoint;
  const testName = `${method} ${path}`;

  switch (method.toUpperCase()) {
    case 'GET':
      return `  describe('${testName}', () => {
    it('deve retornar lista com sucesso', async () => {
      const response = await api.get('${path}');
      
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);
    });

    it('deve retornar 404 para recurso inexistente', async () => {
      try {
        await api.get('${path}/999999');
      } catch (error: any) {
        expect(error.response?.status).toBe(404);
      }
    });

    // TODO: Adicionar mais casos de teste
  });`;

    case 'POST':
      return `  describe('${testName}', () => {
    it('deve criar recurso com sucesso', async () => {
      const data = {
        // TODO: Definir payload
      };

      const response = await api.post('${path}', data);
      
      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
    });

    it('deve validar campos obrigatórios', async () => {
      try {
        await api.post('${path}', {});
      } catch (error: any) {
        expect(error.response?.status).toBe(400);
        expect(error.response?.data).toHaveProperty('errors');
      }
    });

    // TODO: Adicionar mais casos de teste
  });`;

    case 'PUT':
    case 'PATCH':
      return `  describe('${testName}', () => {
    it('deve atualizar recurso com sucesso', async () => {
      const data = {
        // TODO: Definir payload
      };

      const response = await api.${method.toLowerCase()}('${path}', data);
      
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
    });

    it('deve retornar 404 para recurso inexistente', async () => {
      try {
        await api.${method.toLowerCase()}('${path.replace(/:id/, '999999')}', {});
      } catch (error: any) {
        expect(error.response?.status).toBe(404);
      }
    });

    // TODO: Adicionar mais casos de teste
  });`;

    case 'DELETE':
      return `  describe('${testName}', () => {
    it('deve deletar recurso com sucesso', async () => {
      const response = await api.delete('${path}');
      
      expect(response.status).toBe(204);
    });

    it('deve retornar 404 para recurso inexistente', async () => {
      try {
        await api.delete('${path.replace(/:id/, '999999')}');
      } catch (error: any) {
        expect(error.response?.status).toBe(404);
      }
    });

    // TODO: Adicionar mais casos de teste
  });`;

    default:
      return `  // TODO: Implementar teste para ${testName}`;
  }
}

async function generateContractTests(testDir: string, openApiPath: string, repoPath: string) {
  await ensureDir(join(testDir, 'contract'));

  const content = `import { describe, it, expect } from 'vitest';
import { api } from '../helpers/api-client';
import swaggerSpec from '${join(repoPath, openApiPath).replace(/\\/g, '/')}';

describe('API Contract Tests', () => {
  it('deve respeitar o schema OpenAPI', async () => {
    // TODO: Implementar validação de contrato
    // Sugestão: usar libs como openapi-validator
    expect(swaggerSpec).toBeDefined();
  });

  // TODO: Adicionar testes de contrato para cada endpoint
  // Validar que respostas seguem o schema definido no OpenAPI
});
`;

  await writeFileSafe(join(testDir, 'contract', 'api-contract.test.ts'), content);
}

async function generateBasicContractTests(testDir: string, endpoints: Endpoint[]) {
  await ensureDir(join(testDir, 'contract'));

  const contractTest = `import { describe, it, expect } from 'vitest';
import { ApiClient } from '../helpers/api-client';

describe('API Contract Tests', () => {
  const api = new ApiClient();

${endpoints.map(endpoint => `
  describe('${endpoint.method} ${endpoint.path}', () => {
    it('deve retornar estrutura esperada', async () => {
      // TODO: Implementar teste de contrato para ${endpoint.path}
      const response = await api.${endpoint.method.toLowerCase()}('${endpoint.path}');
      
      expect(response).toBeDefined();
      expect(response.status).toBeDefined();
      // TODO: Adicionar validações específicas do contrato
    });
    
    it('deve validar tipos de resposta', async () => {
      // TODO: Validar tipos específicos da resposta
    });
  });
`).join('')}
});
`;

  await writeFileSafe(join(testDir, 'contract', 'api-contract.test.ts'), contractTest);
}

/**
 * Gera guia explicativo sobre Integration Testing
 * [FASE 2] Agora recebe reportsPath diretamente
 */
async function generateIntegrationGuide(reportsPath: string, product: string) {
  const guide = `# Guia de Integration Testing - ${product}

## O Que São Testes de Integração?

Testes de integração (Integration Testing) verificam a comunicação entre diferentes módulos/serviços:
- APIs REST
- Banco de dados
- Serviços externos
- Filas de mensagens
- Cache

## Estrutura

\`\`\`
tests/integration/
├── setup.ts              # Configuração global
├── helpers/
│   ├── api-client.ts    # Cliente HTTP reutilizável
│   ├── database.ts      # Helpers de banco
│   └── test-server.ts   # Inicialização do servidor
├── users/
│   └── users.test.ts    # Testes do domínio users
├── posts/
│   └── posts.test.ts    # Testes do domínio posts
└── contract/
    └── api-contract.test.ts  # Testes de contrato
\`\`\`

## Executar Testes

\`\`\`bash
# Configurar ambiente
export API_BASE_URL="http://localhost:3000"
export DB_URL="postgresql://test:test@localhost:5432/test_db"

# Executar
npm run test:integration

# Com cobertura
npm run test:integration -- --coverage

# Watch mode
npm run test:integration -- --watch
\`\`\`

## Boas Práticas

### 1. Isolamento
Cada teste deve ser independente:
\`\`\`typescript
beforeEach(async () => {
  await cleanDatabase();
  await seedTestData();
});
\`\`\`

### 2. Dados de Teste
Use factories para criar dados consistentes:
\`\`\`typescript
const user = await UserFactory.create({
  email: 'test@example.com'
});
\`\`\`

### 3. Autenticação
Reutilize tokens entre testes:
\`\`\`typescript
let authToken: string;

beforeAll(async () => {
  const user = await createTestUser();
  authToken = await login(user);
  api.setAuthToken(authToken);
});
\`\`\`

### 4. Testes de Erro
Sempre teste casos de erro:
\`\`\`typescript
it('deve retornar 400 para dados inválidos', async () => {
  await expect(
    api.post('/users', { email: 'invalid' })
  ).rejects.toMatchObject({
    response: { status: 400 }
  });
});
\`\`\`

## Contract Testing

Para garantir compatibilidade entre serviços:

\`\`\`typescript
import { PactV3 } from '@pact-foundation/pact';

const provider = new PactV3({
  consumer: 'Frontend',
  provider: 'Backend'
});

describe('User API Contract', () => {
  it('deve retornar usuário pelo ID', async () => {
    await provider
      .given('user exists')
      .uponReceiving('a request for user')
      .withRequest({
        method: 'GET',
        path: '/api/users/1'
      })
      .willRespondWith({
        status: 200,
        body: {
          id: 1,
          name: 'John Doe'
        }
      });
  });
});
\`\`\`

## Banco de Dados

### Setup
\`\`\`typescript
// helpers/database.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function cleanDatabase() {
  await prisma.$transaction([
    prisma.post.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}
\`\`\`

### Migrations
\`\`\`bash
# Criar banco de teste
npm run db:create:test

# Rodar migrations
npm run db:migrate:test

# Reset
npm run db:reset:test
\`\`\`

## CI/CD

\`\`\`yaml
# .github/workflows/integration.yml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      
      - run: npm ci
      - run: npm run db:migrate
      - run: npm run test:integration
\`\`\`

## Métricas

Acompanhe:
- ✅ Cobertura de endpoints (alvo: 80%)
- ✅ Tempo de execução (< 5min ideal)
- ✅ Taxa de falhas (< 1%)
- ✅ Cobertura de casos de erro

## 🚀 Templates Avançados Incluídos

### Supertest
Cliente HTTP para testar APIs Express sem servidor HTTP:
- ✅ \`helpers/supertest-client.ts\` - Client helper
- ✅ \`examples/supertest.example.test.ts\` - Exemplos práticos

**Quando usar:** Testes rápidos de rotas Express, validação de status codes, headers, bodies.

**Instalação:**
\`\`\`bash
npm install --save-dev supertest @types/supertest
\`\`\`

**Exemplo rápido:**
\`\`\`typescript
import { SupertestClient } from './helpers/supertest-client';
import { app } from '../../src/server';

const client = new SupertestClient(app);

it('should create user', async () => {
  const res = await client.post('/api/users', {
    name: 'John',
    email: 'john@example.com'
  }).expect(201);
  
  expect(res.body.id).toBeDefined();
});
\`\`\`

### Testcontainers
Containers Docker reais para testes de integração:
- ✅ \`helpers/testcontainers.ts\` - Manager para PostgreSQL, Redis, MongoDB
- ✅ \`examples/testcontainers.example.test.ts\` - Exemplos completos

**Quando usar:** Testes com banco de dados real, Redis, filas, etc. Garante comportamento idêntico ao produção.

**Instalação:**
\`\`\`bash
npm install --save-dev testcontainers @testcontainers/postgresql pg @types/pg
\`\`\`

**Exemplo rápido:**
\`\`\`typescript
import { TestContainersManager } from './helpers/testcontainers';
import { Client } from 'pg';

let containers: TestContainersManager;
let dbClient: Client;

beforeAll(async () => {
  containers = new TestContainersManager();
  const postgres = await containers.startPostgres();
  
  dbClient = new Client({
    connectionString: postgres.getConnectionUri()
  });
  await dbClient.connect();
}, 60000);

afterAll(async () => {
  await dbClient?.end();
  await containers.stopAll();
});

it('should insert data', async () => {
  await dbClient.query('CREATE TABLE users (id SERIAL, name TEXT)');
  await dbClient.query('INSERT INTO users (name) VALUES ($1)', ['John']);
  
  const result = await dbClient.query('SELECT * FROM users');
  expect(result.rows).toHaveLength(1);
});
\`\`\`

## Recursos

- [Supertest](https://github.com/visionmedia/supertest)
- [Pact](https://docs.pact.io/)
- [TestContainers](https://testcontainers.com/)
- [MSW](https://mswjs.io/) - Mock Service Worker
- [PostgreSQL Client (pg)](https://node-postgres.com/)

---

**Gerado por:** Quality MCP v0.3.0
`;

  // [FASE 2] Salvar direto em reportsPath
  await writeFileSafe(
    join(reportsPath, 'INTEGRATION-TESTING-GUIDE.md'),
    guide
  );
}

/**
 * Gera helpers avançados: Supertest + Testcontainers
 */
async function generateAdvancedHelpers(testDir: string) {
  await ensureDir(join(testDir, 'helpers'));

  // 1. Supertest Client Helper
  const supertestClient = `import request from 'supertest';
import type { Express } from 'express';

/**
 * Cliente Supertest para testes de API
 * Usa o app Express diretamente sem precisar de servidor HTTP
 */
export class SupertestClient {
  private app: Express;
  private authToken?: string;

  constructor(app: Express) {
    this.app = app;
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  /**
   * GET request
   */
  get(url: string) {
    const req = request(this.app).get(url);
    if (this.authToken) {
      req.set('Authorization', \`Bearer \${this.authToken}\`);
    }
    return req;
  }

  /**
   * POST request
   */
  post(url: string, data?: any) {
    const req = request(this.app)
      .post(url)
      .send(data);
    if (this.authToken) {
      req.set('Authorization', \`Bearer \${this.authToken}\`);
    }
    return req;
  }

  /**
   * PUT request
   */
  put(url: string, data?: any) {
    const req = request(this.app)
      .put(url)
      .send(data);
    if (this.authToken) {
      req.set('Authorization', \`Bearer \${this.authToken}\`);
    }
    return req;
  }

  /**
   * DELETE request
   */
  delete(url: string) {
    const req = request(this.app).delete(url);
    if (this.authToken) {
      req.set('Authorization', \`Bearer \${this.authToken}\`);
    }
    return req;
  }

  /**
   * PATCH request
   */
  patch(url: string, data?: any) {
    const req = request(this.app)
      .patch(url)
      .send(data);
    if (this.authToken) {
      req.set('Authorization', \`Bearer \${this.authToken}\`);
    }
    return req;
  }
}

/**
 * Exemplo de uso:
 * 
 * import { app } from '../../../src/server';
 * import { SupertestClient } from './helpers/supertest-client';
 * 
 * describe('Users API', () => {
 *   const client = new SupertestClient(app);
 * 
 *   it('should create user', async () => {
 *     const res = await client.post('/api/users', {
 *       name: 'John Doe',
 *       email: 'john@example.com'
 *     }).expect(201);
 * 
 *     expect(res.body).toHaveProperty('id');
 *     expect(res.body.name).toBe('John Doe');
 *   });
 * });
 */
`;

  await writeFileSafe(join(testDir, 'helpers', 'supertest-client.ts'), supertestClient);

  // 2. Testcontainers Helper
  const testcontainersHelper = `import { 
  PostgreSqlContainer, 
  type StartedPostgreSqlContainer 
} from '@testcontainers/postgresql';
import { 
  GenericContainer, 
  type StartedTestContainer 
} from 'testcontainers';

/**
 * Helper para gerenciar containers de teste
 * Suporta: PostgreSQL, MySQL, MongoDB, Redis, etc.
 */
export class TestContainersManager {
  private containers: Map<string, StartedTestContainer> = new Map();

  /**
   * Inicia container PostgreSQL
   */
  async startPostgres(opts?: {
    database?: string;
    username?: string;
    password?: string;
  }): Promise<StartedPostgreSqlContainer> {
    console.log('🐘 Starting PostgreSQL container...');
    
    const container = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase(opts?.database || 'test_db')
      .withUsername(opts?.username || 'test_user')
      .withPassword(opts?.password || 'test_pass')
      .withExposedPorts(5432)
      .start();

    this.containers.set('postgres', container);
    
    console.log(\`✅ PostgreSQL started: \${container.getConnectionUri()}\`);
    return container;
  }

  /**
   * Inicia container Redis
   */
  async startRedis(): Promise<StartedTestContainer> {
    console.log('🔴 Starting Redis container...');
    
    const container = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .start();

    this.containers.set('redis', container);
    
    const host = container.getHost();
    const port = container.getMappedPort(6379);
    console.log(\`✅ Redis started: redis://\${host}:\${port}\`);
    
    return container;
  }

  /**
   * Inicia container MongoDB
   */
  async startMongo(opts?: {
    database?: string;
  }): Promise<StartedTestContainer> {
    console.log('🍃 Starting MongoDB container...');
    
    const container = await new GenericContainer('mongo:7-jammy')
      .withExposedPorts(27017)
      .withEnvironment({
        MONGO_INITDB_DATABASE: opts?.database || 'test_db'
      })
      .start();

    this.containers.set('mongo', container);
    
    const host = container.getHost();
    const port = container.getMappedPort(27017);
    console.log(\`✅ MongoDB started: mongodb://\${host}:\${port}\`);
    
    return container;
  }

  /**
   * Para todos os containers
   */
  async stopAll(): Promise<void> {
    console.log('🛑 Stopping all containers...');
    
    for (const [name, container] of this.containers.entries()) {
      await container.stop();
      console.log(\`  ✅ Stopped: \${name}\`);
    }
    
    this.containers.clear();
  }

  /**
   * Para um container específico
   */
  async stop(name: string): Promise<void> {
    const container = this.containers.get(name);
    if (container) {
      await container.stop();
      this.containers.delete(name);
      console.log(\`✅ Stopped: \${name}\`);
    }
  }

  /**
   * Obtém container por nome
   */
  get(name: string): StartedTestContainer | undefined {
    return this.containers.get(name);
  }
}

/**
 * Exemplo de uso:
 * 
 * import { TestContainersManager } from './helpers/testcontainers';
 * import { Client } from 'pg';
 * 
 * describe('Database Integration Tests', () => {
 *   let containers: TestContainersManager;
 *   let dbClient: Client;
 * 
 *   beforeAll(async () => {
 *     containers = new TestContainersManager();
 *     const postgres = await containers.startPostgres();
 * 
 *     // Conecta ao banco
 *     dbClient = new Client({
 *       connectionString: postgres.getConnectionUri()
 *     });
 *     await dbClient.connect();
 *   }, 60000); // Timeout maior para download da imagem
 * 
 *   afterAll(async () => {
 *     await dbClient?.end();
 *     await containers.stopAll();
 *   });
 * 
 *   it('should insert and query data', async () => {
 *     await dbClient.query(
 *       'CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)'
 *     );
 *     await dbClient.query(
 *       'INSERT INTO users (name) VALUES ($1)',
 *       ['John Doe']
 *     );
 * 
 *     const result = await dbClient.query('SELECT * FROM users');
 *     expect(result.rows).toHaveLength(1);
 *     expect(result.rows[0].name).toBe('John Doe');
 *   });
 * });
 */
`;

  await writeFileSafe(join(testDir, 'helpers', 'testcontainers.ts'), testcontainersHelper);
}

/**
 * Gera exemplos práticos de testes com Supertest e Testcontainers
 */
async function generateAdvancedExamples(testDir: string) {
  await ensureDir(join(testDir, 'examples'));

  // 1. Exemplo Supertest
  const supertestExample = `import { describe, it, expect, beforeAll } from 'vitest';
import { SupertestClient } from '../helpers/supertest-client';
// import { app } from '../../../src/server'; // Descomente quando tiver o servidor

/**
 * Exemplo de teste de integração usando Supertest
 * 
 * Supertest permite testar APIs Express sem iniciar servidor HTTP
 * Mais rápido e isolado que testes com servidor real
 */
describe('Users API - Supertest Example', () => {
  // const client = new SupertestClient(app); // Descomente quando tiver o app

  it.skip('should create a new user', async () => {
    // TODO: Implementar quando tiver o servidor
    // const res = await client
    //   .post('/api/users', {
    //     name: 'John Doe',
    //     email: 'john@example.com',
    //     password: 'secure123'
    //   })
    //   .expect(201);
    //
    // expect(res.body).toHaveProperty('id');
    // expect(res.body.name).toBe('John Doe');
    // expect(res.body.email).toBe('john@example.com');
    // expect(res.body).not.toHaveProperty('password'); // Não deve retornar senha
  });

  it.skip('should get user by id', async () => {
    // TODO: Implementar quando tiver o servidor
    // // Primeiro cria um usuário
    // const createRes = await client.post('/api/users', {
    //   name: 'Jane Doe',
    //   email: 'jane@example.com',
    //   password: 'secure123'
    // });
    //
    // const userId = createRes.body.id;
    //
    // // Depois busca o usuário
    // const res = await client.get(\`/api/users/\${userId}\`).expect(200);
    //
    // expect(res.body.id).toBe(userId);
    // expect(res.body.name).toBe('Jane Doe');
  });

  it.skip('should return 404 for non-existent user', async () => {
    // TODO: Implementar quando tiver o servidor
    // const res = await client.get('/api/users/99999').expect(404);
    //
    // expect(res.body).toHaveProperty('error');
    // expect(res.body.error).toContain('not found');
  });

  it.skip('should require authentication for protected routes', async () => {
    // TODO: Implementar quando tiver o servidor
    // await client.get('/api/users/me').expect(401);
  });

  it.skip('should authenticate and access protected route', async () => {
    // TODO: Implementar quando tiver o servidor
    // // 1. Login
    // const loginRes = await client.post('/api/auth/login', {
    //   email: 'john@example.com',
    //   password: 'secure123'
    // }).expect(200);
    //
    // const token = loginRes.body.token;
    // client.setAuthToken(token);
    //
    // // 2. Acessar rota protegida
    // const res = await client.get('/api/users/me').expect(200);
    //
    // expect(res.body.email).toBe('john@example.com');
  });

  it.skip('should validate request body', async () => {
    // TODO: Implementar quando tiver o servidor
    // const res = await client.post('/api/users', {
    //   name: 'Invalid User'
    //   // email faltando
    // }).expect(400);
    //
    // expect(res.body).toHaveProperty('errors');
    // expect(res.body.errors).toContain('email is required');
  });
});
`;

  await writeFileSafe(join(testDir, 'examples', 'supertest.example.test.ts'), supertestExample);

  // 2. Exemplo Testcontainers
  const testcontainersExample = `import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestContainersManager } from '../helpers/testcontainers';
import { Client } from 'pg';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

/**
 * Exemplo de teste de integração usando Testcontainers
 * 
 * Testcontainers inicia containers Docker reais para testes
 * Perfeito para testar integração com bancos de dados, Redis, etc.
 */
describe('Database Integration - Testcontainers Example', () => {
  let containers: TestContainersManager;
  let postgres: StartedPostgreSqlContainer;
  let dbClient: Client;

  beforeAll(async () => {
    // Inicia PostgreSQL container
    containers = new TestContainersManager();
    postgres = await containers.startPostgres({
      database: 'test_db',
      username: 'test_user',
      password: 'test_pass'
    });

    // Conecta ao banco
    dbClient = new Client({
      connectionString: postgres.getConnectionUri()
    });
    await dbClient.connect();

    // Cria schema
    await dbClient.query(\`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    \`);
  }, 60000); // Timeout maior para download da imagem Docker

  afterAll(async () => {
    // Cleanup
    await dbClient?.end();
    await containers.stopAll();
  });

  it('should insert user into database', async () => {
    const result = await dbClient.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
      ['John Doe', 'john@example.com']
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      name: 'John Doe',
      email: 'john@example.com'
    });
    expect(result.rows[0].id).toBeDefined();
  });

  it('should query users from database', async () => {
    // Insere múltiplos usuários
    await dbClient.query(
      'INSERT INTO users (name, email) VALUES ($1, $2)',
      ['Jane Doe', 'jane@example.com']
    );
    await dbClient.query(
      'INSERT INTO users (name, email) VALUES ($1, $2)',
      ['Bob Smith', 'bob@example.com']
    );

    // Consulta todos os usuários
    const result = await dbClient.query('SELECT * FROM users ORDER BY id');

    expect(result.rows.length).toBeGreaterThanOrEqual(3); // Inclui o John do teste anterior
    expect(result.rows.some(u => u.email === 'jane@example.com')).toBe(true);
    expect(result.rows.some(u => u.email === 'bob@example.com')).toBe(true);
  });

  it('should enforce unique email constraint', async () => {
    // Primeiro insert deve funcionar
    await dbClient.query(
      'INSERT INTO users (name, email) VALUES ($1, $2)',
      ['User 1', 'duplicate@example.com']
    );

    // Segundo insert com mesmo email deve falhar
    await expect(
      dbClient.query(
        'INSERT INTO users (name, email) VALUES ($1, $2)',
        ['User 2', 'duplicate@example.com']
      )
    ).rejects.toThrow(/duplicate key value violates unique constraint/);
  });

  it('should update user', async () => {
    // Insere usuário
    const insertResult = await dbClient.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id',
      ['Old Name', 'update@example.com']
    );
    const userId = insertResult.rows[0].id;

    // Atualiza nome
    await dbClient.query(
      'UPDATE users SET name = $1 WHERE id = $2',
      ['New Name', userId]
    );

    // Verifica atualização
    const selectResult = await dbClient.query(
      'SELECT name FROM users WHERE id = $1',
      [userId]
    );

    expect(selectResult.rows[0].name).toBe('New Name');
  });

  it('should delete user', async () => {
    // Insere usuário
    const insertResult = await dbClient.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id',
      ['To Delete', 'delete@example.com']
    );
    const userId = insertResult.rows[0].id;

    // Deleta
    await dbClient.query('DELETE FROM users WHERE id = $1', [userId]);

    // Verifica que foi deletado
    const selectResult = await dbClient.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    expect(selectResult.rows).toHaveLength(0);
  });

  it('should handle transactions', async () => {
    // Inicia transação
    await dbClient.query('BEGIN');

    try {
      await dbClient.query(
        'INSERT INTO users (name, email) VALUES ($1, $2)',
        ['Transaction User', 'transaction@example.com']
      );

      // Simula erro
      throw new Error('Rollback test');
    } catch (error) {
      // Rollback
      await dbClient.query('ROLLBACK');
    }

    // Verifica que o insert foi revertido
    const result = await dbClient.query(
      'SELECT * FROM users WHERE email = $1',
      ['transaction@example.com']
    );

    expect(result.rows).toHaveLength(0);
  });
});

/**
 * Exemplo com Redis (descomente para usar)
 */
describe.skip('Redis Integration - Testcontainers Example', () => {
  let containers: TestContainersManager;
  // let redisClient: RedisClientType;

  beforeAll(async () => {
    containers = new TestContainersManager();
    const redis = await containers.startRedis();

    // const host = redis.getHost();
    // const port = redis.getMappedPort(6379);

    // redisClient = createClient({
    //   url: \`redis://\${host}:\${port}\`
    // });
    // await redisClient.connect();
  }, 60000);

  afterAll(async () => {
    // await redisClient?.quit();
    await containers.stopAll();
  });

  it.skip('should set and get value from Redis', async () => {
    // await redisClient.set('test_key', 'test_value');
    // const value = await redisClient.get('test_key');
    // expect(value).toBe('test_value');
  });
});
`;

  await writeFileSafe(join(testDir, 'examples', 'testcontainers.example.test.ts'), testcontainersExample);
}

async function updatePackageJsonWithIntegrationScripts(repoPath: string) {
  const packageJsonPath = join(repoPath, 'package.json');
  
  if (await fileExists(packageJsonPath)) {
    const content = await readFile(packageJsonPath);
    const packageJson = JSON.parse(content);
    
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }
    
    // Adiciona scripts de teste
    packageJson.scripts['test:integration'] = 'vitest tests/integration';
    packageJson.scripts['test:integration:watch'] = 'vitest tests/integration --watch';
    packageJson.scripts['test:integration:coverage'] = 'vitest tests/integration --coverage';
    
    // Adiciona devDependencies recomendadas (se ainda não existem)
    if (!packageJson.devDependencies) {
      packageJson.devDependencies = {};
    }
    
    const recommendedDeps = {
      'supertest': '^6.3.3',
      '@types/supertest': '^6.0.2',
      'testcontainers': '^10.2.1',
      '@testcontainers/postgresql': '^10.2.1',
      'pg': '^8.11.3',
      '@types/pg': '^8.10.9'
    };
    
    let depsAdded = false;
    for (const [dep, version] of Object.entries(recommendedDeps)) {
      if (!packageJson.devDependencies[dep] && !packageJson.dependencies?.[dep]) {
        packageJson.devDependencies[dep] = version;
        depsAdded = true;
      }
    }
    
    await writeFileSafe(packageJsonPath, JSON.stringify(packageJson, null, 2));
    
    if (depsAdded) {
      console.log('\n📦 Dependências adicionadas ao package.json:');
      console.log('   - supertest: Testes de API Express');
      console.log('   - testcontainers: Containers Docker para testes');
      console.log('   - @testcontainers/postgresql: Helper PostgreSQL');
      console.log('   - pg: Cliente PostgreSQL');
      console.log('\n💡 Execute: npm install');
    }
  }
}

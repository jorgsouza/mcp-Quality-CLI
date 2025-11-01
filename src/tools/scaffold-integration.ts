import { join } from 'node:path';
import { writeFileSafe, ensureDir, readFile, fileExists } from '../utils/fs.js';
import { loadMCPSettings, mergeSettings } from '../utils/config.js';
import { findExpressRoutes, findOpenAPI, type Endpoint } from '../detectors/express.js';

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

  // Valida base_url se fornecida
  if (settings.base_url && settings.base_url !== '') {
    try {
      new URL(settings.base_url);
    } catch (error) {
      throw new Error(`URL inválida: ${settings.base_url}`);
    }
  }

  const testDir = join(input.repo, 'tests', 'integration');
  await ensureDir(testDir);

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

  // Gera testes por domínio
  const endpointsByDomain = groupEndpointsByDomain(endpoints);
  
  for (const [domain, domainEndpoints] of Object.entries(endpointsByDomain)) {
    const testFile = await generateDomainIntegrationTests(
      testDir,
      domain,
      domainEndpoints,
      settings.base_url
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
  await generateIntegrationGuide(input.repo, settings.product || 'Product');
  generated.push('tests/analyses/INTEGRATION-TESTING-GUIDE.md');

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
  baseUrl?: string
): Promise<string> {
  const domainDir = join(testDir, domain);
  await ensureDir(domainDir);

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

async function generateIntegrationGuide(repoPath: string, product: string) {
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

## Recursos

- [Supertest](https://github.com/visionmedia/supertest)
- [Pact](https://docs.pact.io/)
- [TestContainers](https://testcontainers.com/)
- [MSW](https://mswjs.io/) - Mock Service Worker

---

**Gerado por:** Quality MCP v0.2.0
`;

  await writeFileSafe(
    join(repoPath, 'tests', 'analyses', 'INTEGRATION-TESTING-GUIDE.md'),
    guide
  );
}

async function updatePackageJsonWithIntegrationScripts(repoPath: string) {
  const packageJsonPath = join(repoPath, 'package.json');
  
  if (await fileExists(packageJsonPath)) {
    const content = await readFile(packageJsonPath);
    const packageJson = JSON.parse(content);
    
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }
    
    packageJson.scripts['test:integration'] = 'vitest tests/integration';
    packageJson.scripts['test:integration:watch'] = 'vitest tests/integration --watch';
    packageJson.scripts['test:integration:coverage'] = 'vitest tests/integration --coverage';
    
    await writeFileSafe(packageJsonPath, JSON.stringify(packageJson, null, 2));
  }
}

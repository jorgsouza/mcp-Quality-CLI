# 🚀 Supertest & Testcontainers - Templates Avançados

## 📖 Visão Geral

A partir da **v0.3.0**, o `scaffold-integration` gera automaticamente templates avançados para testes de integração usando:

- **Supertest**: Testes de API Express sem servidor HTTP
- **Testcontainers**: Containers Docker reais para testes

---

## 🎯 Por Que Usar?

### Supertest
✅ **Rápido**: Testa rotas Express sem iniciar servidor HTTP  
✅ **Isolado**: Cada teste é independente  
✅ **Simples**: Sintaxe fluente e intuitiva  
✅ **Completo**: Valida status, headers, body, cookies

### Testcontainers
✅ **Real**: Testa com bancos de dados e serviços reais  
✅ **Isolado**: Cada teste tem seu próprio container  
✅ **Confiável**: Comportamento idêntico ao produção  
✅ **Portável**: Funciona em qualquer máquina com Docker

---

## 📦 Instalação

Ao executar `scaffold-integration`, as dependências são automaticamente adicionadas ao `package.json`:

```bash
npm install --save-dev \
  supertest \
  @types/supertest \
  testcontainers \
  @testcontainers/postgresql \
  pg \
  @types/pg
```

**Requisito:** Docker instalado e rodando (para Testcontainers)

---

## 🔧 Arquivos Gerados

```
tests/integration/
├── helpers/
│   ├── api-client.ts              # Cliente HTTP (Axios)
│   ├── supertest-client.ts        # Cliente Supertest ✨ NOVO
│   └── testcontainers.ts          # Manager de containers ✨ NOVO
└── examples/
    ├── supertest.example.test.ts  # Exemplos Supertest ✨ NOVO
    └── testcontainers.example.test.ts  # Exemplos Testcontainers ✨ NOVO
```

---

## 🧪 Supertest - Guia Rápido

### Exemplo Básico

```typescript
import { describe, it, expect } from 'vitest';
import { SupertestClient } from '../helpers/supertest-client';
import { app } from '../../src/server'; // Seu app Express

describe('Users API', () => {
  const client = new SupertestClient(app);

  it('should create user', async () => {
    const res = await client
      .post('/api/users', {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'secure123'
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('John Doe');
    expect(res.body).not.toHaveProperty('password'); // Nunca retorna senha
  });

  it('should get user by id', async () => {
    const res = await client.get('/api/users/1').expect(200);
    expect(res.body.id).toBe(1);
  });

  it('should return 404 for non-existent user', async () => {
    await client.get('/api/users/99999').expect(404);
  });
});
```

### Com Autenticação

```typescript
it('should authenticate and access protected route', async () => {
  // 1. Login
  const loginRes = await client.post('/api/auth/login', {
    email: 'john@example.com',
    password: 'secure123'
  }).expect(200);

  const token = loginRes.body.token;
  client.setAuthToken(token);

  // 2. Acessar rota protegida
  const res = await client.get('/api/users/me').expect(200);
  expect(res.body.email).toBe('john@example.com');
});
```

### Validação de Erros

```typescript
it('should validate request body', async () => {
  const res = await client.post('/api/users', {
    name: 'Invalid User'
    // email faltando
  }).expect(400);

  expect(res.body).toHaveProperty('errors');
  expect(res.body.errors).toContain('email is required');
});
```

---

## 🐳 Testcontainers - Guia Rápido

### Exemplo Básico (PostgreSQL)

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestContainersManager } from '../helpers/testcontainers';
import { Client } from 'pg';

describe('Database Integration', () => {
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
    await dbClient.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL
      )
    `);
  }, 60000); // Timeout maior para download da imagem Docker

  afterAll(async () => {
    await dbClient?.end();
    await containers.stopAll();
  });

  it('should insert user', async () => {
    const result = await dbClient.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
      ['John Doe', 'john@example.com']
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe('John Doe');
  });

  it('should enforce unique email', async () => {
    await dbClient.query(
      'INSERT INTO users (name, email) VALUES ($1, $2)',
      ['User 1', 'dup@example.com']
    );

    // Segundo insert deve falhar
    await expect(
      dbClient.query(
        'INSERT INTO users (name, email) VALUES ($1, $2)',
        ['User 2', 'dup@example.com']
      )
    ).rejects.toThrow(/duplicate key value/);
  });
});
```

### Redis Example

```typescript
import { createClient } from 'redis';

describe('Redis Integration', () => {
  let containers: TestContainersManager;
  let redisClient;

  beforeAll(async () => {
    containers = new TestContainersManager();
    const redis = await containers.startRedis();

    const host = redis.getHost();
    const port = redis.getMappedPort(6379);

    redisClient = createClient({
      url: `redis://${host}:${port}`
    });
    await redisClient.connect();
  }, 60000);

  afterAll(async () => {
    await redisClient?.quit();
    await containers.stopAll();
  });

  it('should set and get value', async () => {
    await redisClient.set('key', 'value');
    const result = await redisClient.get('key');
    expect(result).toBe('value');
  });
});
```

### MongoDB Example

```typescript
import { MongoClient } from 'mongodb';

describe('MongoDB Integration', () => {
  let containers: TestContainersManager;
  let mongoClient: MongoClient;

  beforeAll(async () => {
    containers = new TestContainersManager();
    const mongo = await containers.startMongo({ database: 'test_db' });

    const host = mongo.getHost();
    const port = mongo.getMappedPort(27017);

    mongoClient = new MongoClient(`mongodb://${host}:${port}/test_db`);
    await mongoClient.connect();
  }, 60000);

  afterAll(async () => {
    await mongoClient?.close();
    await containers.stopAll();
  });

  it('should insert document', async () => {
    const db = mongoClient.db('test_db');
    const collection = db.collection('users');

    const result = await collection.insertOne({
      name: 'John Doe',
      email: 'john@example.com'
    });

    expect(result.insertedId).toBeDefined();
  });
});
```

---

## 🎯 Quando Usar Cada Um?

### Use Supertest quando:
- ✅ Testar rotas Express/API
- ✅ Validar status codes, headers, bodies
- ✅ Testes rápidos (<100ms por teste)
- ✅ Não precisa de banco de dados real

### Use Testcontainers quando:
- ✅ Testar integração com banco de dados
- ✅ Testar queries SQL complexas
- ✅ Validar constraints, triggers, indexes
- ✅ Testar Redis, MongoDB, filas, etc.
- ✅ Garantir comportamento idêntico ao produção

### Combine os dois:
```typescript
describe('Full Integration Test', () => {
  let containers: TestContainersManager;
  let dbClient: Client;
  let client: SupertestClient;

  beforeAll(async () => {
    // 1. Inicia banco
    containers = new TestContainersManager();
    const postgres = await containers.startPostgres();
    
    dbClient = new Client({
      connectionString: postgres.getConnectionUri()
    });
    await dbClient.connect();

    // 2. Configura app com banco de teste
    process.env.DATABASE_URL = postgres.getConnectionUri();
    const { app } = await import('../../src/server');
    client = new SupertestClient(app);
  }, 60000);

  afterAll(async () => {
    await dbClient?.end();
    await containers.stopAll();
  });

  it('should create user via API and verify in database', async () => {
    // 1. Cria via API
    const res = await client.post('/api/users', {
      name: 'John',
      email: 'john@example.com'
    }).expect(201);

    const userId = res.body.id;

    // 2. Verifica no banco
    const result = await dbClient.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe('John');
  });
});
```

---

## 🚀 Executar Testes

```bash
# Todos os testes de integração
npm run test:integration

# Watch mode
npm run test:integration:watch

# Com cobertura
npm run test:integration:coverage

# Apenas exemplos
npm test tests/integration/examples
```

---

## 📊 Performance

### Supertest
- ⚡ **Muito rápido**: 10-50ms por teste
- 💾 **Leve**: Sem overhead de rede
- 🎯 **Ideal para**: TDD, CI/CD, dev local

### Testcontainers
- 🐢 **Mais lento**: 
  - Primeiro teste: ~10-30s (download imagem)
  - Testes seguintes: ~1-3s (reusa imagem)
- 💾 **Médio**: Containers leves (Alpine)
- 🎯 **Ideal para**: Integration tests, smoke tests, staging

---

## 🔥 Boas Práticas

### 1. Isole cada teste
```typescript
beforeEach(async () => {
  // Limpa banco antes de cada teste
  await dbClient.query('TRUNCATE TABLE users CASCADE');
});
```

### 2. Use transações
```typescript
beforeEach(async () => {
  await dbClient.query('BEGIN');
});

afterEach(async () => {
  await dbClient.query('ROLLBACK');
});
```

### 3. Reutilize containers
```typescript
// ❌ Ruim: Cria container em cada teste
it('test 1', async () => {
  const container = await new PostgreSqlContainer().start();
  // ...
  await container.stop();
});

// ✅ Bom: Reutiliza container
beforeAll(async () => {
  container = await new PostgreSqlContainer().start();
}, 60000);

afterAll(async () => {
  await container.stop();
});
```

### 4. Timeouts adequados
```typescript
// Primeiro teste (download imagem)
beforeAll(async () => {
  // ...
}, 60000); // 60 segundos

// Testes individuais
it('test', async () => {
  // ...
}, 10000); // 10 segundos
```

---

## 🐛 Troubleshooting

### Docker not found
```bash
# Instalar Docker Desktop (Mac/Windows)
# ou Docker Engine (Linux)
docker --version
```

### Container não inicia
```bash
# Verificar se Docker está rodando
docker ps

# Limpar containers antigos
docker system prune -a
```

### Testes lentos
```bash
# Pré-baixar imagens
docker pull postgres:15-alpine
docker pull redis:7-alpine
docker pull mongo:7-jammy
```

### Porta já em uso
```bash
# Testcontainers usa portas aleatórias automaticamente
# Use getMappedPort() ao invés de porta fixa
```

---

## 📚 Recursos

- [Supertest Docs](https://github.com/visionmedia/supertest)
- [Testcontainers Docs](https://testcontainers.com/)
- [Testcontainers Node](https://node.testcontainers.org/)
- [PostgreSQL Client](https://node-postgres.com/)
- [Redis Client](https://github.com/redis/node-redis)
- [MongoDB Client](https://www.mongodb.com/docs/drivers/node/)

---

**Gerado por:** Quality MCP v0.3.0  
**Feature:** Supertest & Testcontainers Templates

# 🤝 CDC Guide: Contract Testing with Pact

> **Consumer-Driven Contract (CDC) Testing** garante que microsserviços e APIs se comunicam corretamente sem necessidade de testes E2E caros e frágeis.

---

## 📚 Table of Contents

1. [O que é CDC/Pact?](#o-que-é-cdcpact)
2. [Quando usar CDC?](#quando-usar-cdc)
3. [Quick Start](#quick-start)
4. [Exemplos Práticos](#exemplos-práticos)
5. [Pact Broker](#pact-broker)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

---

## O que é CDC/Pact?

### Conceito

**Consumer-Driven Contract (CDC)** é uma abordagem de teste onde:

1. **Consumer** (cliente da API) define **expectativas** (contratos) de como a API deve se comportar
2. **Provider** (servidor da API) **verifica** que atende todas essas expectativas
3. Contratos são versionados e compartilhados via **Pact Broker**

### Pact Framework

**Pact** é a ferramenta líder de CDC testing, com suporte para:
- **Linguagens**: TypeScript, JavaScript, Python, Java, Go, Ruby, .NET, PHP, Rust
- **Protocolos**: HTTP, Message Queues (async)
- **Integrações**: CI/CD, Docker, Kubernetes

### Fluxo do Teste

```
┌─────────────┐                    ┌─────────────┐
│  Consumer   │                    │  Provider   │
│   (Client)  │                    │   (API)     │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │ 1. Define expectations           │
       │    (consumer test)                │
       │                                  │
       │ 2. Generate pact file            │
       ├──────────────────────────────────►
       │                                  │
       │                                  │ 3. Verify contract
       │                                  │    (provider test)
       │                                  │
       │ 4. Publish to broker             │
       ◄──────────────────────────────────┤
       │                                  │
       │ 5. Can I deploy?                 │
       ├──────────────────────────────────►
       │                                  │
```

### Benefícios

✅ **Sem necessidade de E2E**: Testa integração sem subir múltiplos serviços  
✅ **Feedback rápido**: Detecta breaking changes antes do deploy  
✅ **Contratos versionados**: Histórico completo de mudanças de API  
✅ **Independent deployment**: Valida compatibilidade entre versões  
✅ **Living documentation**: Contratos servem como documentação atualizada

---

## Quando usar CDC?

### ✅ Use CDC quando:

- **Arquitetura de microsserviços** com múltiplas APIs
- **APIs REST/GraphQL** consumidas por vários clientes
- **Equipes independentes** desenvolvendo consumer/provider
- **Deploys frequentes** que podem quebrar integrações
- **Múltiplas versões** de API em produção
- **Contratos críticos** que não podem quebrar (ex: pagamentos)

### ❌ NÃO use CDC quando:

- **Monolito** sem APIs externas
- **Poucas integrações** (< 3 endpoints)
- **Controle total** do código consumer e provider (mesmo repo)
- **APIs públicas** sem controle dos consumers
- **Protótipos** ou MVPs descartáveis

### Exemplo de Decisão

```
Endpoints detectados: 15+
Consumers externos: Sim (mobile app, web app, parceiros)
Deploys/semana: 20+
→ USE CDC ✅

Endpoints detectados: 2
Consumers: Apenas frontend do mesmo repo
Deploys/semana: 1
→ NÃO USE CDC ❌
```

---

## Quick Start

### 1. Scaffolding Automático

O **mcp-Quality-CLI** detecta automaticamente serviços e gera contratos:

```bash
# Modo manual
npx @mcp/quality-cli scaffold_contracts_pact \
  --repo /path/to/repo \
  --product my-api

# Modo automático (via auto.ts)
npx @mcp/quality-cli auto \
  --repo /path/to/repo \
  --product my-api \
  --mode full
```

**Saída**:
```
qa/my-api/tests/contracts/
├── pact.config.ts              # Configuração Pact
├── my-api-client-my-api-users-api.pact.spec.ts  # Consumer test
├── my-api-users-api-provider.pact.spec.ts       # Provider test
└── pacts/
    └── my-api-client-my-api-users-api.json      # Contrato gerado
```

### 2. Executar Consumer Tests

```bash
npm test
```

**Resultado**: Gera `pacts/*.json` com contratos.

### 3. Verificar Provider

```bash
npx @mcp/quality-cli run_contracts_verify \
  --repo /path/to/repo \
  --product my-api \
  --provider_base_url http://localhost:3000
```

**Saída**:
```
✅ Contract verification complete!
   Verification rate: 100%
   Verified: 5/5
   Failed: 0
```

---

## Exemplos Práticos

### TypeScript / JavaScript

#### Consumer Test (Jest/Vitest)

```typescript
import { Pact } from '@pact-foundation/pact';
import { createUser } from '../api/users';

describe('User API Consumer', () => {
  const provider = new Pact({
    consumer: 'mobile-app',
    provider: 'users-api',
    port: 1234,
  });

  beforeAll(() => provider.setup());
  afterEach(() => provider.verify());
  afterAll(() => provider.finalize());

  it('should create a user', async () => {
    // Define expectation (contract)
    await provider.addInteraction({
      state: 'user does not exist',
      uponReceiving: 'a request to create a user',
      withRequest: {
        method: 'POST',
        path: '/api/users',
        headers: { 'Content-Type': 'application/json' },
        body: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      },
      willRespondWith: {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: {
          id: Matchers.integer(1),
          name: 'John Doe',
          email: 'john@example.com',
          created_at: Matchers.iso8601DateTime(),
        },
      },
    });

    // Execute consumer code
    const user = await createUser({
      name: 'John Doe',
      email: 'john@example.com',
    });

    // Assert
    expect(user.id).toBe(1);
    expect(user.name).toBe('John Doe');
  });
});
```

#### Provider Test

```typescript
import { Verifier } from '@pact-foundation/pact';
import app from '../src/app';

describe('User API Provider', () => {
  let server: any;

  beforeAll(() => {
    server = app.listen(3000);
  });

  afterAll(() => {
    server.close();
  });

  it('should verify contracts', async () => {
    await new Verifier({
      provider: 'users-api',
      providerBaseUrl: 'http://localhost:3000',
      pactUrls: ['./pacts/mobile-app-users-api.json'],
      stateHandlers: {
        'user does not exist': async () => {
          // Setup: Clear database
          await db.users.deleteAll();
        },
      },
    }).verifyProvider();
  });
});
```

---

### Python

#### Consumer Test (unittest)

```python
import unittest
from pact import Consumer, Provider

class UserAPIConsumerTest(unittest.TestCase):
    def setUp(self):
        self.pact = Consumer('mobile-app').has_pact_with(
            Provider('users-api'),
            port=1234
        )
        self.pact.start_service()

    def tearDown(self):
        self.pact.stop_service()

    def test_create_user(self):
        # Define contract
        (self.pact
         .given('user does not exist')
         .upon_receiving('a request to create a user')
         .with_request('POST', '/api/users', body={
             'name': 'John Doe',
             'email': 'john@example.com'
         })
         .will_respond_with(201, body={
             'id': Like(1),
             'name': 'John Doe',
             'email': 'john@example.com',
             'created_at': Format().iso_8601_datetime()
         }))

        # Execute consumer
        with self.pact:
            user = create_user('John Doe', 'john@example.com')
            self.assertEqual(user['name'], 'John Doe')
```

#### Provider Test

```python
from pact import Verifier

def test_provider():
    verifier = Verifier(provider='users-api')
    
    success = verifier.verify_pacts(
        './pacts/mobile-app-users-api.json',
        provider_base_url='http://localhost:5000',
        provider_states_setup_url='http://localhost:5000/_pact/provider-states'
    )
    
    assert success
```

---

### Java (Spring Boot)

#### Consumer Test (JUnit 5)

```java
import au.com.dius.pact.consumer.dsl.PactDslWithProvider;
import au.com.dius.pact.consumer.junit5.PactConsumerTestExt;
import au.com.dius.pact.consumer.junit5.PactTestFor;
import au.com.dius.pact.core.model.RequestResponsePact;
import au.com.dius.pact.core.model.annotations.Pact;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

@ExtendWith(PactConsumerTestExt.class)
@PactTestFor(providerName = "users-api", port = "1234")
class UserAPIConsumerTest {

    @Pact(consumer = "mobile-app")
    public RequestResponsePact createUserPact(PactDslWithProvider builder) {
        return builder
            .given("user does not exist")
            .uponReceiving("a request to create a user")
            .path("/api/users")
            .method("POST")
            .body("{\"name\":\"John Doe\",\"email\":\"john@example.com\"}")
            .willRespondWith()
            .status(201)
            .body("{\"id\":1,\"name\":\"John Doe\",\"email\":\"john@example.com\"}")
            .toPact();
    }

    @Test
    void testCreateUser() {
        User user = userApi.createUser("John Doe", "john@example.com");
        assertEquals("John Doe", user.getName());
    }
}
```

#### Provider Test

```java
import au.com.dius.pact.provider.junit5.PactVerificationContext;
import au.com.dius.pact.provider.junit5.PactVerificationInvocationContextProvider;
import au.com.dius.pact.provider.junitsupport.Provider;
import au.com.dius.pact.provider.junitsupport.State;
import au.com.dius.pact.provider.junitsupport.loader.PactFolder;
import org.junit.jupiter.api.TestTemplate;
import org.junit.jupiter.api.extension.ExtendWith;

@Provider("users-api")
@PactFolder("pacts")
class UserAPIProviderTest {

    @TestTemplate
    @ExtendWith(PactVerificationInvocationContextProvider.class)
    void verifyPact(PactVerificationContext context) {
        context.verifyInteraction();
    }

    @State("user does not exist")
    void userDoesNotExist() {
        userRepository.deleteAll();
    }
}
```

---

## Pact Broker

### O que é?

**Pact Broker** é um repositório centralizado de contratos que:
- Armazena todos os pact files versionados
- Valida compatibilidade antes do deploy
- Gera matriz de compatibilidade entre versões
- Oferece webhooks para CI/CD

### Setup (Docker)

```bash
docker run -d \
  --name pact-broker \
  -p 9292:9292 \
  -e PACT_BROKER_DATABASE_URL=postgres://user:pass@postgres/pact_broker \
  pactfoundation/pact-broker
```

### Publicar Contratos

```bash
# TypeScript
npx pact-broker publish \
  ./pacts \
  --consumer-app-version 1.0.0 \
  --broker-base-url https://pact-broker.example.com \
  --broker-token your-token

# Python
pact-broker publish \
  ./pacts \
  --consumer-app-version 1.0.0 \
  --broker-base-url https://pact-broker.example.com \
  --broker-token your-token
```

### Can I Deploy?

```bash
npx pact-broker can-i-deploy \
  --pacticipant mobile-app \
  --version 1.0.0 \
  --to-environment production \
  --broker-base-url https://pact-broker.example.com \
  --broker-token your-token
```

**Saída**:
```
✅ Computer says yes \o/

CONSUMER        | C.VERSION | PROVIDER   | P.VERSION | SUCCESS?
----------------|-----------|------------|-----------|----------
mobile-app      | 1.0.0     | users-api  | 2.3.1     | true
```

### Integração com mcp-Quality-CLI

```bash
# Scaffold com broker
npx @mcp/quality-cli scaffold_contracts_pact \
  --repo /path/to/repo \
  --product my-api \
  --broker_url https://pact-broker.example.com \
  --broker_token your-token

# Verify e publish
npx @mcp/quality-cli run_contracts_verify \
  --repo /path/to/repo \
  --product my-api \
  --publish true
```

---

## Troubleshooting

### ❌ Erro: "No pact files found"

**Causa**: Consumer tests não foram executados.

**Solução**:
```bash
npm test  # Gera pacts/*.json
```

---

### ❌ Erro: "Provider state not found"

**Causa**: Provider test não implementou stateHandler.

**Solução**:
```typescript
stateHandlers: {
  'user does not exist': async () => {
    await db.users.deleteAll();
  },
}
```

---

### ❌ Erro: "Request did not match"

**Causa**: Provider retornou resposta diferente do contrato.

**Exemplo**:
```
Expected: status 201
Actual:   status 200
```

**Solução**:
1. Verificar se provider implementou endpoint corretamente
2. Atualizar consumer test se expectativa estava errada
3. Negociar mudança de contrato com time do consumer

---

### ❌ Erro: "Connection refused"

**Causa**: Provider não está rodando.

**Solução**:
```bash
npm start  # ou docker-compose up
```

---

### ⚠️ Warning: "Verification rate < 80%"

**Causa**: Alguns contratos falharam.

**Solução**:
```bash
# Ver detalhes
cat qa/my-api/tests/reports/CONTRACTS-VERIFY.md

# Corrigir providers com falhas
# Re-executar verificação
```

---

## Best Practices

### 1. **Use matchers para dados dinâmicos**

❌ **Evite**:
```typescript
body: {
  id: 123,  // Hard-coded
  created_at: '2025-11-03T20:00:00Z'  // Hard-coded
}
```

✅ **Use**:
```typescript
import { Matchers } from '@pact-foundation/pact';

body: {
  id: Matchers.integer(123),
  created_at: Matchers.iso8601DateTime()
}
```

---

### 2. **Mantenha contratos simples**

❌ **Evite** contratos gigantes com 50+ campos.

✅ **Use** apenas campos essenciais:
```typescript
body: {
  id: Matchers.integer(),
  name: Matchers.string(),
  // Omitir campos internos
}
```

---

### 3. **Versione semanticamente**

```bash
pact-broker publish --consumer-app-version 2.1.0
```

- **Major (2.x.x)**: Breaking changes
- **Minor (x.1.x)**: Novos recursos (compatível)
- **Patch (x.x.0)**: Bug fixes

---

### 4. **Automatize no CI/CD**

```yaml
# .github/workflows/pact.yml
name: Pact Tests

on: [push, pull_request]

jobs:
  consumer:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm test
      - run: npx pact-broker publish ./pacts
        env:
          PACT_BROKER_TOKEN: ${{ secrets.PACT_BROKER_TOKEN }}

  provider:
    needs: consumer
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm start &
      - run: npx pact-broker verify
        env:
          PACT_BROKER_TOKEN: ${{ secrets.PACT_BROKER_TOKEN }}
```

---

### 5. **Use Can I Deploy antes do merge**

```bash
# Pre-merge check
npx pact-broker can-i-deploy \
  --pacticipant my-api \
  --version $(git rev-parse HEAD) \
  --to-environment production

# Se retornar erro, NÃO fazer merge!
```

---

## Recursos Adicionais

📖 **Documentação oficial**: https://docs.pact.io/  
🎥 **Vídeos**: https://www.youtube.com/c/PactFoundation  
💬 **Slack**: https://slack.pact.io/  
📦 **Pact Broker**: https://github.com/pact-foundation/pact_broker  
🔧 **Pact CLI**: https://github.com/pact-foundation/pact-ruby-standalone  

---

## Suporte

Problemas com CDC no **mcp-Quality-CLI**?

1. Verifique logs em `qa/<product>/tests/reports/CONTRACTS-VERIFY.md`
2. Abra issue: https://github.com/jorgsouza/mcp-Quality-CLI/issues
3. Slack: #mcp-quality-cli

---

**Happy Contract Testing! 🤝✨**

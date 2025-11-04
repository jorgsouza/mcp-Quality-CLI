# 🎯 Uso por Stack - Guia Prático

Exemplos práticos de uso do Quality MCP para diferentes stacks.

## 📋 Índice

- [Next.js + TypeScript](#nextjs--typescript)
- [Django + Python](#django--python)
- [Go API](#go-api)
- [NestJS + TypeScript](#nestjs--typescript)
- [FastAPI + Python](#fastapi--python)

---

## Next.js + TypeScript

### Setup Inicial

```bash
# 1. Instalar Quality MCP
npm install -g quality-mcp

# 2. Instalar dependências de teste no projeto
cd my-nextjs-app
npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/user-event
```

### Análise Completa

```bash
quality auto --repo . --product "MyNextApp"
```

**Output**:
```
✅ 156 funções analisadas
✅ 42 rotas detectadas (app/ + pages/)
✅ 89 testes unitários gerados
✅ 15 testes E2E Playwright gerados
📊 Coverage: 82%
📈 Quality Score: A (95/100)
```

### Estrutura Gerada

```
qa/MyNextApp/
├── tests/
│   ├── unit/
│   │   ├── app/
│   │   │   └── components/
│   │   │       ├── Header.test.tsx
│   │   │       └── Footer.test.tsx
│   │   └── lib/
│   │       └── utils.test.ts
│   ├── integration/
│   │   └── api/
│   │       └── products.test.ts
│   └── e2e/
│       ├── home.spec.ts
│       ├── auth.spec.ts
│       └── checkout.spec.ts
└── dashboards/
    └── dashboard.html
```

### Scripts Recomendados

Adicione no `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:e2e": "playwright test",
    "test:coverage": "vitest --coverage",
    "quality:analyze": "quality analyze --repo .",
    "quality:full": "quality auto --repo . --product MyNextApp"
  }
}
```

---

## Django + Python

### Setup Inicial

```bash
# 1. Criar virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate    # Windows

# 2. Instalar dependências
pip install pytest pytest-cov pytest-django mutmut hypothesis

# 3. Instalar Quality MCP
npm install -g quality-mcp
```

### Análise Completa

```bash
quality auto --repo . --product "MyDjangoApp"
```

**Output**:
```
✅ 89 views analisadas
✅ 45 models detectados
✅ 67 testes unitários gerados (pytest)
✅ 23 testes de integração (database)
📊 Coverage: 78%
📈 Mutation Score: 72%
```

### Estrutura Gerada

```
qa/MyDjangoApp/
├── tests/
│   ├── unit/
│   │   ├── test_models.py
│   │   ├── test_views.py
│   │   └── test_serializers.py
│   ├── integration/
│   │   └── test_api_endpoints.py
│   └── property/
│       └── test_business_rules.py
└── dashboards/
    └── dashboard.html
```

### pytest.ini

```ini
[pytest]
DJANGO_SETTINGS_MODULE = myproject.settings
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = 
    -ra
    -q
    --cov=.
    --cov-report=html
    --cov-report=xml
    --cov-report=term
testpaths = qa/MyDjangoApp/tests
```

### Scripts Recomendados

```bash
# Testes
pytest qa/MyDjangoApp/tests/

# Coverage
pytest --cov=myapp --cov-report=html

# Mutation
mutmut run --paths-to-mutate=myapp/

# Quality full
quality auto --repo . --product MyDjangoApp
```

---

## Go API

### Setup Inicial

```bash
# 1. Instalar ferramentas Go
go install gotest.tools/gotestsum@latest
go install github.com/zimmski/go-mutesting/cmd/go-mutesting@latest

# 2. Instalar Quality MCP
npm install -g quality-mcp
```

### Análise Completa

```bash
quality auto --repo . --product "MyGoAPI"
```

**Output**:
```
✅ 67 funções analisadas
✅ 34 handlers detectados
✅ 56 testes unitários gerados
✅ 12 testes de integração (HTTP)
📊 Coverage: 85% (statements)
📈 Quality Score: A (92/100)
```

### Estrutura com Build Tags

```go
// handler_test.go (unit)
package api

import "testing"

func TestGetUser(t *testing.T) {
    // teste unitário rápido
}
```

```go
// handler_integration_test.go
//go:build integration

package api

import "testing"

func TestGetUserIntegration(t *testing.T) {
    // teste de integração com DB real
}
```

### Executar Testes

```bash
# Unit tests apenas
go test ./... -short

# Integration tests
go test ./... -tags=integration

# E2E tests
go test ./... -tags=e2e

# Coverage
go test ./... -cover -coverprofile=coverage.out
go tool cover -html=coverage.out

# Com gotestsum (melhor output)
gotestsum --format testname -- -cover ./...
```

---

## NestJS + TypeScript

### Setup Inicial

```bash
# 1. Instalar dependências
npm install -D @nestjs/testing vitest @vitest/coverage-v8 @stryker-mutator/core

# 2. Instalar Quality MCP
npm install -g quality-mcp
```

### Análise Completa

```bash
quality auto --repo . --product "MyNestApp"
```

### Estrutura Gerada

```
qa/MyNestApp/
├── tests/
│   ├── unit/
│   │   ├── users/
│   │   │   ├── users.service.test.ts
│   │   │   └── users.controller.test.ts
│   │   └── auth/
│   │       └── auth.service.test.ts
│   ├── integration/
│   │   └── api/
│   │       └── users-api.test.ts
│   └── e2e/
│       ├── users.e2e-spec.ts
│       └── auth.e2e-spec.ts
└── dashboards/
    └── dashboard.html
```

### vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    },
  },
});
```

---

## FastAPI + Python

### Setup Inicial

```bash
# 1. Virtual environment
python -m venv venv
source venv/bin/activate

# 2. Dependências
pip install pytest pytest-cov pytest-asyncio httpx mutmut hypothesis

# 3. Quality MCP
npm install -g quality-mcp
```

### Análise Completa

```bash
quality auto --repo . --product "MyFastAPI"
```

### Estrutura Gerada

```
qa/MyFastAPI/
├── tests/
│   ├── unit/
│   │   ├── test_models.py
│   │   ├── test_services.py
│   │   └── test_utils.py
│   ├── integration/
│   │   └── test_api_endpoints.py
│   └── property/
│       └── test_business_invariants.py
└── dashboards/
    └── dashboard.html
```

### Test Example

```python
# tests/unit/test_users_service.py
import pytest
from app.services.users import UserService

@pytest.fixture
def user_service():
    return UserService()

def test_create_user(user_service):
    user = user_service.create_user("john@example.com", "password123")
    assert user.email == "john@example.com"
    assert user.hashed_password is not None

# tests/integration/test_api_endpoints.py
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_get_users():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/users")
        assert response.status_code == 200
```

---

## 🎯 Comandos Comuns (Todos Stacks)

### Análise Rápida

```bash
quality analyze --repo .
```

### Apenas Coverage

```bash
quality coverage --repo .
```

### Apenas Mutation

```bash
quality mutation --repo .
```

### Self-Check (Verificar Ambiente)

```bash
quality self-check --repo .
```

### Bootstrap Dependencies

```bash
quality self-check --repo . --bootstrap-deps
./bootstrap-deps.sh  # Revisar e executar
```

---

## 🔧 Integração com CI/CD

### GitHub Actions

```yaml
name: Quality Check

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install Quality MCP
        run: npm install -g quality-mcp
      
      - name: Run Quality Analysis
        run: quality auto --repo . --product MyApp
      
      - name: Upload Reports
        uses: actions/upload-artifact@v3
        with:
          name: quality-reports
          path: qa/MyApp/tests/reports/
```

---

## 📞 Suporte

Problemas? Consulte:
- [SETUP-BY-LANGUAGE.md](SETUP-BY-LANGUAGE.md) - Setup detalhado
- [README.md](../README.md) - Documentação completa
- [GitHub Issues](https://github.com/seu-usuario/mcp-Quality-CLI/issues)

---

**Última atualização**: Novembro 2025


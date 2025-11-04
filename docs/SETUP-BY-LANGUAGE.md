# 🌐 Setup por Linguagem

Guia completo de configuração do Quality MCP para cada linguagem suportada.

## 📋 Índice

- [TypeScript/JavaScript](#typescriptjavascript)
- [Python](#python)
- [Go](#go)
- [Java](#java-em-desenvolvimento)

---

## TypeScript/JavaScript

### 🎯 Status: ✅ Produção (Completo)

### Pré-requisitos

- Node.js >= 18.0.0
- npm ou yarn ou pnpm

### Instalação Completa

```bash
# 1. Instalar dependências de teste
npm install -D vitest @vitest/coverage-v8

# 2. Instalar dependências de mutation
npm install -D @stryker-mutator/core @stryker-mutator/vitest-runner

# 3. (Opcional) Playwright para testes E2E
npm install -D @playwright/test

# 4. (Opcional) Jest como alternativa
npm install -D jest @types/jest ts-jest
```

### Estrutura Mínima

Criar `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: ['node_modules/', 'dist/', '**/*.test.ts'],
    },
    globals: true,
    environment: 'node',
  },
});
```

### Executar Quality MCP

```bash
# Análise completa
quality auto --repo . --product "MyApp"

# Apenas análise de código
quality analyze --repo .

# Apenas coverage
quality coverage --repo .
```

### Frameworks Suportados

| Framework | Detecção | Coverage | Mutation | Scaffold |
|-----------|----------|----------|----------|----------|
| **Vitest** | ✅ | ✅ | ✅ | ✅ |
| **Jest** | ✅ | ✅ | ✅ | ✅ |
| **Mocha** | ✅ | ✅ | ⚪ | ✅ |

---

## Python

### 🎯 Status: ✅ Produção (Completo)

### Pré-requisitos

- Python >= 3.8
- pip ou poetry

### Instalação Completa

```bash
# 1. Instalar dependências de teste
pip install pytest pytest-cov pytest-xdist

# 2. Instalar mutation testing
pip install mutmut

# 3. (Opcional) Property-based testing
pip install hypothesis

# 4. (Opcional) Tox para múltiplas versões
pip install tox
```

### Estrutura Mínima

Criar `pytest.ini`:

```ini
[pytest]
minversion = 7.0
addopts = -ra -q --cov=. --cov-report=xml --cov-report=html --cov-report=term
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
```

### Executar Quality MCP

```bash
# Análise completa
quality auto --repo . --product "MyPythonApp"

# Apenas testes
quality run --repo . --types unit,integration

# Coverage + mutation
quality coverage --repo .
quality mutation --repo .
```

### Frameworks Suportados

| Framework | Detecção | Coverage | Mutation | Scaffold |
|-----------|----------|----------|----------|----------|
| **pytest** | ✅ | ✅ | ✅ | ✅ |
| **unittest** | ✅ | ✅ | ✅ | ✅ |

### Dicas Python

1. **Virtual Environment**: Sempre use venv/virtualenv
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   venv\Scripts\activate     # Windows
   ```

2. **Cobertura Mínima**: Configure em `setup.cfg`
   ```ini
   [coverage:run]
   branch = True
   omit = tests/*,venv/*
   
   [coverage:report]
   fail_under = 80
   ```

3. **Mutation Config**: Criar `.mutmut-config`
   ```ini
   [mutmut]
   paths_to_mutate=src/
   backup=False
   runner=pytest -x
   tests_dir=tests/
   ```

---

## Go

### 🎯 Status: 🟡 Beta

### Pré-requisitos

- Go >= 1.19
- go mod

### Instalação Completa

```bash
# 1. Ferramentas de teste (já built-in no Go)
# go test vem com o Go

# 2. (Opcional) Melhor output de testes
go install gotest.tools/gotestsum@latest

# 3. (Opcional) Mutation testing
go install github.com/zimmski/go-mutesting/cmd/go-mutesting@latest

# 4. (Opcional) Coverage visualization
go install github.com/axw/gocov/gocov@latest
go install github.com/matm/gocov-html/cmd/gocov-html@latest
```

### Estrutura Mínima

Criar `go.mod` (se não existir):

```bash
go mod init github.com/myuser/myproject
```

### Build Tags para Organizar Testes

**Unit tests** (`file_test.go`):
```go
package mypackage

import "testing"

func TestCalculateTotal(t *testing.T) {
    // teste unitário rápido
}
```

**Integration tests** (`file_integration_test.go`):
```go
//go:build integration

package mypackage

import "testing"

func TestDatabaseIntegration(t *testing.T) {
    // teste de integração
}
```

**E2E tests** (`file_e2e_test.go`):
```go
//go:build e2e

package mypackage

import "testing"

func TestEndToEnd(t *testing.T) {
    // teste end-to-end
}
```

### Executar Quality MCP

```bash
# Análise completa
quality auto --repo . --product "MyGoApp"

# Apenas unit tests
go test ./... -short

# Integration tests
go test ./... -tags=integration

# E2E tests
go test ./... -tags=e2e

# Coverage
go test ./... -cover -coverprofile=coverage.out
go tool cover -html=coverage.out -o coverage.html
```

### Frameworks Suportados

| Framework | Detecção | Coverage | Mutation | Scaffold |
|-----------|----------|----------|----------|----------|
| **go test** | ✅ | ✅ | 🟡 | ✅ |

### Dicas Go

1. **Table-Driven Tests**: Padrão Go
   ```go
   func TestCalculate(t *testing.T) {
       tests := []struct {
           name     string
           input    int
           expected int
       }{
           {"zero", 0, 0},
           {"positive", 5, 25},
       }
       
       for _, tt := range tests {
           t.Run(tt.name, func(t *testing.T) {
               got := Calculate(tt.input)
               if got != tt.expected {
                   t.Errorf("got %d, want %d", got, tt.expected)
               }
           })
       }
   }
   ```

2. **Paralelismo**: Use `t.Parallel()`
   ```go
   func TestSomething(t *testing.T) {
       t.Parallel()
       // teste rápido que pode rodar em paralelo
   }
   ```

3. **Benchmarks**: Perfil de performance
   ```go
   func BenchmarkCalculate(b *testing.B) {
       for i := 0; i < b.N; i++ {
           Calculate(100)
       }
   }
   ```

---

## Java (Em Desenvolvimento)

### 🎯 Status: ⚪ Planejado (Q1 2026)

### Pré-requisitos (Futuro)

- Java >= 11
- Maven ou Gradle

### Instalação Planejada

**Maven:**
```xml
<dependencies>
    <dependency>
        <groupId>org.junit.jupiter</groupId>
        <artifactId>junit-jupiter</artifactId>
        <version>5.9.0</version>
        <scope>test</scope>
    </dependency>
</dependencies>

<build>
    <plugins>
        <plugin>
            <groupId>org.jacoco</groupId>
            <artifactId>jacoco-maven-plugin</artifactId>
            <version>0.8.10</version>
        </plugin>
        <plugin>
            <groupId>org.pitest</groupId>
            <artifactId>pitest-maven</artifactId>
            <version>1.14.0</version>
        </plugin>
    </plugins>
</build>
```

**Gradle:**
```groovy
dependencies {
    testImplementation 'org.junit.jupiter:junit-jupiter:5.9.0'
}

plugins {
    id 'jacoco'
    id 'info.solidsoft.pitest' version '1.9.11'
}
```

### Status da Implementação

- [ ] JavaAdapter com JUnit 5 / TestNG
- [ ] Parser JaCoCo XML
- [ ] Integração PIT (mutation)
- [ ] Scaffolding de testes
- [ ] Suporte Maven e Gradle

**Previsão**: Q1 2026

---

## 🔍 Verificar Compatibilidade

Execute o comando de diagnóstico:

```bash
quality self-check --repo .
```

Exemplo de output:

```
🔍 Verificando ambiente...

✅ Node.js: v18.17.0
✅ TypeScript: 5.2.2
✅ Vitest: 1.0.0
✅ Coverage: @vitest/coverage-v8@1.0.0
⚠️  Stryker não instalado (mutation testing desabilitado)

📊 Capacidades disponíveis:
✅ Análise de código
✅ Execução de testes
✅ Cobertura de código
⚪ Mutation testing (faltando: stryker)

🎯 Recomendações:
- Instalar @stryker-mutator/core para mutation testing
```

---

## 🆘 Troubleshooting

### TypeScript

**Problema**: `Cannot find module 'vitest'`
```bash
npm install -D vitest
```

**Problema**: Coverage vazio
```bash
# Verificar vitest.config.ts
# Adicionar: coverage.include = ['src/**/*.ts']
```

### Python

**Problema**: `pytest: command not found`
```bash
pip install --upgrade pip
pip install pytest
```

**Problema**: `ModuleNotFoundError`
```bash
# Adicionar ao PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
```

### Go

**Problema**: `go: cannot find main module`
```bash
go mod init <module-name>
```

**Problema**: Testes não encontrados
```bash
# Verificar padrão: *_test.go
ls -la *_test.go
```

---

## 📞 Suporte

Se você encontrar problemas:

1. Verifique a versão: `quality --version`
2. Execute diagnóstico: `quality self-check`
3. Abra uma issue: [GitHub Issues](https://github.com/seu-usuario/mcp-Quality-CLI/issues)

---

**Última atualização**: Novembro 2025


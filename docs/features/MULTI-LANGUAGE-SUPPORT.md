# 🌍 Suporte Multi-Linguagem - Quality MCP

**Versão:** v0.4.0  
**Data:** 2025-10-31  
**Feature:** Detecção automática de linguagem e framework

---

## 📋 Visão Geral

O Quality MCP agora é **agnóstico a linguagem**, detectando automaticamente a stack tecnológica do projeto e usando as ferramentas apropriadas para execução de testes e análise de cobertura.

---

## 🎯 Linguagens Suportadas

### ✅ TypeScript / JavaScript
- **Frameworks:** Vitest, Jest, Mocha
- **Comando:** `npm run test:coverage` ou `npx nyc npm test`
- **Cobertura:** `coverage/coverage-summary.json` (Istanbul/NYC)
- **Padrões de Teste:** `*.test.{ts,tsx,js,jsx}`, `*.spec.{ts,tsx,js,jsx}`, `__tests__/**`

### ✅ Java
- **Frameworks:** JUnit (Maven/Gradle)
- **Comando:** `mvn clean test jacoco:report` ou `./gradlew test jacocoTestReport`
- **Cobertura:** `target/site/jacoco/jacoco.xml` ou `build/reports/jacoco/test/jacocoTestReport.xml`
- **Padrões de Teste:** `*Test.java`, `*Tests.java`

### ✅ Go
- **Framework:** go test
- **Comando:** `go test -coverprofile=coverage.out ./...`
- **Cobertura:** `coverage.out`
- **Padrões de Teste:** `*_test.go`

### ✅ Ruby
- **Frameworks:** RSpec, Minitest
- **Comando:** `bundle exec rspec` ou `bundle exec rake test`
- **Cobertura:** `coverage/.resultset.json` (SimpleCov)
- **Padrões de Teste:** `*_spec.rb`, `*_test.rb`

### ✅ Python
- **Framework:** pytest
- **Comando:** `pytest --cov=. --cov-report=json`
- **Cobertura:** `coverage.json` (coverage.py)
- **Padrões de Teste:** `test_*.py`, `*_test.py`

### ✅ C# / .NET
- **Framework:** NUnit, xUnit
- **Comando:** `dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=cobertura`
- **Cobertura:** `coverage.cobertura.xml`
- **Padrões de Teste:** `*Tests.cs`, `*Test.cs`

### ✅ PHP
- **Framework:** PHPUnit
- **Comando:** `./vendor/bin/phpunit --coverage-clover coverage.xml`
- **Cobertura:** `coverage.xml` (Clover)
- **Padrões de Teste:** `*Test.php`

### ✅ Rust
- **Framework:** cargo test
- **Comando:** `cargo tarpaulin --out Json`
- **Cobertura:** `tarpaulin-report.json`
- **Padrões de Teste:** `*_test.rs`, `tests/**/*.rs`

---

## 🔍 Detecção Automática

O Quality MCP detecta a linguagem verificando arquivos de configuração:

| Linguagem | Arquivo Detectado | Framework Padrão |
|-----------|-------------------|------------------|
| TypeScript/JS | `package.json` | Vitest/Jest/Mocha |
| Java | `pom.xml` ou `build.gradle` | JUnit |
| Go | `go.mod` | go test |
| Ruby | `Gemfile` | RSpec/Minitest |
| Python | `requirements.txt`, `setup.py`, `pyproject.toml` | pytest |
| C# | `*.csproj`, `*.sln` | NUnit |
| PHP | `composer.json` | PHPUnit |
| Rust | `Cargo.toml` | cargo test |

---

## 📊 Formatos de Cobertura Suportados

### JSON (Istanbul/NYC)
```json
{
  "total": {
    "lines": { "total": 100, "covered": 80, "pct": 80 },
    "functions": { "total": 20, "covered": 16, "pct": 80 },
    "branches": { "total": 40, "covered": 32, "pct": 80 },
    "statements": { "total": 100, "covered": 80, "pct": 80 }
  }
}
```

### XML (JaCoCo - Java)
```xml
<counter type="LINE" missed="20" covered="80"/>
<counter type="BRANCH" missed="8" covered="32"/>
<counter type="METHOD" missed="4" covered="16"/>
```

### Coverage.out (Go)
```
mode: set
github.com/user/project/file.go:10.2,12.3 2 1
github.com/user/project/file.go:14.2,16.3 2 0
```

### SimpleCov JSON (Ruby)
```json
{
  "coverage": {
    "/path/to/file.rb": [null, 1, 1, 0, null, 1]
  }
}
```

### Coverage.py JSON (Python)
```json
{
  "totals": {
    "num_statements": 100,
    "covered_lines": 80,
    "percent_covered": 80.0,
    "num_branches": 40,
    "covered_branches": 32
  }
}
```

### Cobertura XML (.NET)
```xml
<coverage line-rate="0.80" branch-rate="0.75">
  ...
</coverage>
```

### Clover XML (PHP)
```xml
<metrics elements="100" coveredelements="80" statements="100" coveredstatements="80"/>
```

---

## 🚀 Exemplos de Uso

### TypeScript/JavaScript (Vitest)

```bash
$ quality run-coverage --repo /path/to/ts-project

🔍 Detectando linguagem e framework de teste...
✅ Detectado: TypeScript/JavaScript com Vitest
📦 Linguagem: typescript
🧪 Framework: vitest
⚙️  Comando: npm run test:coverage

📊 Executando testes com cobertura...
✅ Testes executados com sucesso!

📊 Cobertura Geral:
   Lines:      85.42% (1234/1445)
   Functions:  78.90% (45/57)
   Branches:   82.15% (312/380)
   Statements: 85.42% (1234/1445)

🎯 Status: ✅ GOOD
```

### Java (Maven + JUnit)

```bash
$ quality run-coverage --repo /path/to/java-project

🔍 Detectando linguagem e framework de teste...
✅ Detectado: Java com Maven (JUnit)
📦 Linguagem: java
🧪 Framework: junit
⚙️  Comando: mvn clean test jacoco:report

📊 Executando testes com cobertura...
✅ Testes executados com sucesso!

📊 Cobertura Geral:
   Lines:      72.30% (845/1169)
   Functions:  68.50% (34/50)
   Branches:   75.20% (188/250)
   Statements: 72.30% (845/1169)

🎯 Status: ✅ GOOD
```

### Go

```bash
$ quality run-coverage --repo /path/to/go-project

🔍 Detectando linguagem e framework de teste...
✅ Detectado: Go
📦 Linguagem: golang
🧪 Framework: go-test
⚙️  Comando: go test -coverprofile=coverage.out ./...

📊 Executando testes com cobertura...
✅ Testes executados com sucesso!

📊 Cobertura Geral:
   Lines:      78.90% (456/578)
   Statements: 78.90% (456/578)

🎯 Status: ✅ GOOD
```

### Python (pytest)

```bash
$ quality run-coverage --repo /path/to/python-project

🔍 Detectando linguagem e framework de teste...
✅ Detectado: Python com pytest
📦 Linguagem: python
🧪 Framework: pytest
⚙️  Comando: pytest --cov=. --cov-report=json

📊 Executando testes com cobertura...
✅ Testes executados com sucesso!

📊 Cobertura Geral:
   Lines:      82.50% (678/822)
   Branches:   76.30% (145/190)
   Statements: 82.50% (678/822)

🎯 Status: ✅ GOOD
```

### Ruby (RSpec)

```bash
$ quality run-coverage --repo /path/to/ruby-project

🔍 Detectando linguagem e framework de teste...
✅ Detectado: Ruby com RSpec
📦 Linguagem: ruby
🧪 Framework: rspec
⚙️  Comando: bundle exec rspec

📊 Executando testes com cobertura...
✅ Testes executados com sucesso!

📊 Cobertura Geral:
   Lines:      88.20% (567/643)
   Statements: 88.20% (567/643)

🎯 Status: 🎉 EXCELLENT
```

---

## 🔧 Configuração por Linguagem

### TypeScript/JavaScript

**package.json:**
```json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "@vitest/coverage-v8": "^2.0.0"
  }
}
```

**vitest.config.ts:**
```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html']
    }
  }
});
```

### Java (Maven)

**pom.xml:**
```xml
<plugin>
  <groupId>org.jacoco</groupId>
  <artifactId>jacoco-maven-plugin</artifactId>
  <version>0.8.10</version>
  <executions>
    <execution>
      <goals>
        <goal>prepare-agent</goal>
        <goal>report</goal>
      </goals>
    </execution>
  </executions>
</plugin>
```

### Go

**go.mod:**
```go
module github.com/user/project

go 1.21
```

**Comando:**
```bash
go test -coverprofile=coverage.out ./...
go tool cover -func=coverage.out
```

### Python

**requirements.txt:**
```
pytest>=7.0.0
pytest-cov>=4.0.0
```

**pyproject.toml:**
```toml
[tool.pytest.ini_options]
addopts = "--cov=. --cov-report=json"
```

### Ruby

**Gemfile:**
```ruby
group :test do
  gem 'rspec'
  gem 'simplecov', require: false
end
```

**spec/spec_helper.rb:**
```ruby
require 'simplecov'
SimpleCov.start
```

---

## 🎯 Templates de Teste por Linguagem

O Quality MCP gera templates de teste apropriados para cada linguagem:

### TypeScript/JavaScript
```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from './myFile';

describe('myFunction', () => {
  it('should work correctly', () => {
    expect(myFunction()).toBe(true);
  });
});
```

### Java
```java
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class MyFunctionTest {
    @Test
    void shouldWorkCorrectly() {
        assertTrue(myFunction());
    }
}
```

### Go
```go
package main

import "testing"

func TestMyFunction(t *testing.T) {
    if !myFunction() {
        t.Error("Expected true, got false")
    }
}
```

### Python
```python
import pytest

def test_my_function_works_correctly():
    assert my_function() == True
```

### Ruby
```ruby
require 'spec_helper'

RSpec.describe MyFunction do
  it 'works correctly' do
    expect(my_function).to be true
  end
end
```

---

## 📊 Comparação de Frameworks

| Linguagem | Framework | Velocidade | Cobertura | Popularidade |
|-----------|-----------|------------|-----------|--------------|
| TS/JS | Vitest | ⚡⚡⚡ | ✅✅✅ | ⭐⭐⭐⭐⭐ |
| TS/JS | Jest | ⚡⚡ | ✅✅✅ | ⭐⭐⭐⭐⭐ |
| Java | JUnit 5 | ⚡⚡ | ✅✅✅ | ⭐⭐⭐⭐⭐ |
| Go | go test | ⚡⚡⚡ | ✅✅ | ⭐⭐⭐⭐⭐ |
| Ruby | RSpec | ⚡⚡ | ✅✅✅ | ⭐⭐⭐⭐⭐ |
| Python | pytest | ⚡⚡⚡ | ✅✅✅ | ⭐⭐⭐⭐⭐ |
| C# | NUnit | ⚡⚡ | ✅✅✅ | ⭐⭐⭐⭐ |
| PHP | PHPUnit | ⚡⚡ | ✅✅✅ | ⭐⭐⭐⭐⭐ |
| Rust | cargo test | ⚡⚡⚡ | ✅✅ | ⭐⭐⭐⭐ |

---

## 🎊 Benefícios

### Para Desenvolvedores
- ✅ **Zero configuração** - Detecção automática
- ✅ **Mesma interface** para todas as linguagens
- ✅ **Análise consistente** independente da stack
- ✅ **Recomendações específicas** por linguagem

### Para Times Polyglot
- ✅ **Um único tool** para múltiplas stacks
- ✅ **Métricas padronizadas** entre projetos
- ✅ **Comparação justa** de cobertura
- ✅ **Governança unificada**

### Para QA
- ✅ **Visibilidade completa** de todos os projetos
- ✅ **Relatórios consistentes** independente da linguagem
- ✅ **Thresholds uniformes** entre stacks
- ✅ **Histórico comparável**

---

## 🚀 Próximos Passos

### Roadmap

- [ ] Suporte para Kotlin (Android)
- [ ] Suporte para Swift (iOS)
- [ ] Suporte para Scala
- [ ] Suporte para Elixir
- [ ] Suporte para Dart/Flutter
- [ ] Detecção de monorepos
- [ ] Análise por workspace

---

## 📚 Referências

- [Vitest](https://vitest.dev/)
- [Jest](https://jestjs.io/)
- [JUnit 5](https://junit.org/junit5/)
- [Go Testing](https://go.dev/doc/tutorial/add-a-test)
- [RSpec](https://rspec.info/)
- [pytest](https://pytest.org/)
- [NUnit](https://nunit.org/)
- [PHPUnit](https://phpunit.de/)
- [cargo test](https://doc.rust-lang.org/cargo/commands/cargo-test.html)

---

**Gerado por:** Quality MCP v0.4.0  
**Data:** 2025-10-31  
**Feature:** Multi-Language Support 🌍


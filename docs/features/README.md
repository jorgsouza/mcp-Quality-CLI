# ✨ Features - Quality MCP

Esta pasta contém a documentação detalhada de todas as features avançadas do Quality MCP.

## 📖 Features Disponíveis

### [MULTI-LANGUAGE-SUPPORT.md](MULTI-LANGUAGE-SUPPORT.md)
**Suporte Multi-Linguagem e Multi-Framework**

Detecção automática e suporte para múltiplas linguagens e frameworks:

- ✅ TypeScript/JavaScript (Next.js, Express, NestJS, React)
- ✅ Python (Django, Flask, FastAPI)
- ✅ Java (Spring Boot)
- ✅ Go (Gin, Echo)

**Status:** ✅ Implementado (TypeScript/JavaScript completo)

---

### [RECOMMENDATION-FEATURE.md](RECOMMENDATION-FEATURE.md)
**Sistema de Recomendação de Estratégias**

Recomendação inteligente de estratégia de testes baseada em análise do código:

- ✅ Análise de complexidade do projeto
- ✅ Detecção de padrões (API, SPA, SSR)
- ✅ Recomendação de ferramentas (Playwright, Supertest, Vitest)
- ✅ Priorização de testes (Unit → Integration → E2E)

**Comando:**
```bash
quality recommend-strategy --repo /path/to/project
```

**Status:** ✅ Implementado v0.3.0

---

### [RISK-SCORE-SYSTEM.md](RISK-SCORE-SYSTEM.md)
**Sistema de Pontuação de Risco**

Cálculo automático de risco para endpoints e arquivos:

- ✅ Algoritmo: `Risk Score = (Probability × Impact) / 10`
- ✅ Fatores: OpenAPI contract, critical flows, test coverage, complexity
- ✅ Classificação: HIGH (≥70), MEDIUM (40-69), LOW (<40)
- ✅ Integração com planos de teste

**Exemplo:**
```typescript
{
  endpoint: "/api/auth/login",
  riskScore: 75,
  level: "HIGH",
  factors: {
    hasOpenAPIContract: false,
    hasCriticalFlow: true,
    testCoverage: 45
  }
}
```

**Status:** ✅ Implementado v0.3.0

---

### [SUPERTEST-TESTCONTAINERS.md](SUPERTEST-TESTCONTAINERS.md)
**Templates Supertest & Testcontainers**

Geração automática de helpers para testes de integração:

- ✅ **Supertest**: Cliente HTTP para testes Express sem servidor
- ✅ **Testcontainers**: Containers Docker (PostgreSQL, Redis, MongoDB)
- ✅ 13+ exemplos práticos prontos para uso
- ✅ Auto-instalação de dependências

**Arquivos Gerados:**
```
tests/helpers/
├── supertest-client.ts       (180 linhas)
└── testcontainers.ts         (220 linhas)

tests/examples/
├── supertest.example.test.ts (140 linhas)
└── testcontainers.example.test.ts (280 linhas)
```

**Status:** ✅ Implementado v0.3.0

---

## 📊 Status das Features

| Feature | Versão | Status | Docs |
|---------|--------|--------|------|
| Multi-Language Support | v0.2.0 | ✅ Completo (TS/JS) | ✅ |
| Recommendation System | v0.3.0 | ✅ Completo | ✅ |
| Risk Score System | v0.3.0 | ✅ Completo | ✅ |
| Supertest/Testcontainers | v0.3.0 | ✅ Completo | ✅ |
| LLM → Contratos | Backlog | ⏳ Planejado | ❌ |

## 🎯 Roadmap

### v0.4.0 (Planejado)
- 🔮 LLM → Contratos (geração via Gemini API)
- 📊 Visual Regression Tests (Percy/BackstopJS)
- 🧪 Mutation Testing (Stryker.js)

### v0.5.0 (Futuro)
- 🐍 Python completo (Django, Flask, FastAPI)
- ☕ Java completo (Spring Boot)
- 🐹 Go completo (Gin, Echo)

## 🔍 Navegação Rápida

### Preciso calcular risco de endpoints?
→ [RISK-SCORE-SYSTEM.md](RISK-SCORE-SYSTEM.md)

### Preciso testes de integração com DB real?
→ [SUPERTEST-TESTCONTAINERS.md](SUPERTEST-TESTCONTAINERS.md)

### Preciso saber qual estratégia usar?
→ [RECOMMENDATION-FEATURE.md](RECOMMENDATION-FEATURE.md)

### Meu projeto é Python/Java/Go?
→ [MULTI-LANGUAGE-SUPPORT.md](MULTI-LANGUAGE-SUPPORT.md)

## 📚 Outros Recursos

- 🏠 [Documentação Principal](../README.md)
- 🚀 [Guias de Usuário](../guides/README.md)
- 🏗️ [Arquitetura](../architecture/ARCHITECTURE.md)

---

**Última atualização:** 2025-11-01  
**Versão:** 0.3.0

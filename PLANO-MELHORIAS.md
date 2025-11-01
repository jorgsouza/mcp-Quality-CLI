# Plano de Melhorias MCP Quality - Status de Implementação

## ✅ Implementado (Fase 1)

### 1. Sistema de Configuração Centralizada
- ✅ Criado `src/utils/config.ts` com:
  - Schema Zod para validação de `mcp-settings.json`
  - Função `loadMCPSettings()` que busca config em `/qa/<PRODUTO>/mcp-settings.json` ou `/mcp-settings.json`
  - Função `mergeSettings()` para mesclar config de arquivo com parâmetros explícitos
  - Função `createMCPSettingsTemplate()` para criar estrutura inicial

### 2. Idempotência Melhorada (writeFileSafe)
- ✅ Atualizado `src/utils/fs.ts`:
  - Backup automático (`.bak`) antes de sobrescrever arquivos existentes
  - Parâmetro `createBackup` para controlar comportamento

### 3. Playwright Config com Boas Práticas
- ✅ Atualizado `src/tools/scaffold.ts`:
  - Support para `storageState` global
  - Projeto `setup` separado para autenticação
  - Configuração de `trace: 'on-first-retry'`
  - `screenshot: 'only-on-failure'` e `video: 'retain-on-failure'`
  - Projects: chromium, webkit, mobile-chrome
  - Setup file `tests/auth.setup.ts` para autenticação global

### 4. Ferramenta de Inicialização de Produto
- ✅ Criado `src/tools/init-product.ts`:
  - Cria estrutura completa `/qa/<PRODUTO>/`
  - Gera `mcp-settings.json` baseado em template
  - Cria diretórios: `tests/{unit,integration,e2e,analyses,reports}`
  - Cria `fixtures/auth/`
  - Gera `GETTING_STARTED.md` customizado
  - Cria `.gitignore` e `README.md`

### 5. Documentação GETTING_STARTED.md
- ✅ Template completo em `src/tools/templates/GETTING_STARTED.md`:
  - Estrutura do projeto
  - Responsabilidades Dev vs QA
  - Guia completo de ferramentas MCP
  - Sequência de comandos (analyze → plan → scaffold → run → coverage)
  - Configuração de CI/CD
  - Convenções de nomenclatura
  - Quality gates

### 6. Exemplo de mcp-settings.json Atualizado
- ✅ Atualizado `mcp-settings.example.json` com estrutura completa:
  ```json
  {
    "product": "ReclameAQUI",
    "base_url": "https://www.reclameaqui.com.br",
    "domains": ["auth", "search", "claim", "profile"],
    "critical_flows": [...],
    "targets": { "diff_coverage_min": 80, ... },
    "environments": { "dev": {...}, "stg": {...}, "prod": {...} },
    "auth": { "strategy": "storageState", ... }
  }
  ```

## 🚧 Próximos Passos (Fase 2)

### 7. Integrar Configuração nas Tools Existentes
**Prioridade: ALTA**

Atualizar cada tool para:
```typescript
// Exemplo: src/tools/analyze.ts
import { loadMCPSettings, mergeSettings } from '../utils/config.js';

export async function analyze(input: AnalyzeParams) {
  // 1. Carregar config do arquivo
  const fileSettings = await loadMCPSettings(input.repo, input.product);
  
  // 2. Mesclar com parâmetros
  const settings = mergeSettings(fileSettings, input);
  
  // 3. Usar settings mesclado
  const domains = settings.domains || [];
  const criticalFlows = settings.critical_flows || [];
  // ...
}
```

**Tools a atualizar:**
- [ ] `analyze.ts`
- [ ] `plan.ts`
- [ ] `scaffold.ts`
- [ ] `scaffold-unit.ts`
- [ ] `scaffold-integration.ts`
- [ ] `coverage.ts`
- [ ] `run.ts`
- [ ] `dashboard.ts`
- [ ] `report.ts`

### 8. Adicionar Validações Zod Robustas ao Server
**Prioridade: ALTA**

Em `src/server.ts`, adicionar validações:
```typescript
const AnalyzeSchema = z.object({
  repo: z.string()
    .min(1, 'Repository path is required')
    .refine(async (path) => await fileExists(path), 'Repository does not exist'),
  product: z.string()
    .min(1, 'Product name is required')
    .max(50, 'Product name too long'),
  base_url: z.string()
    .url('Base URL must be valid')
    .optional(),
  // ...
});
```

### 9. Sistema de Risco Probabilístico
**Prioridade: MÉDIA**

Criar `src/utils/risk-calculator.ts`:
```typescript
interface RiskScore {
  probability: number;  // 0-100
  impact: number;       // 0-100
  score: number;        // probability × impact
}

function calculateRisk(context: {
  changeFrequency: number;    // commits nos últimos 30 dias
  coverage: number;           // % de cobertura
  complexity: number;         // cyclomatic complexity
  flakyHistory: number;       // % de flakiness histórico
  isCriticalDomain: boolean;  // domínio em critical_flows?
}): RiskScore
```

Integrar em:
- [ ] `analyze.ts` - calcular score por arquivo/endpoint
- [ ] `plan.ts` - ordenar tarefas por score de risco
- [ ] `recommend-strategy.ts` - ajustar proporções por risco

### 10. Diff-Coverage
**Prioridade: ALTA**

Atualizar `src/tools/coverage.ts`:
```typescript
async function calculateDiffCoverage(repoPath: string): Promise<{
  diff_files: string[];
  diff_lines_covered: number;
  diff_lines_total: number;
  diff_coverage_pct: number;
}> {
  // 1. git diff --name-only HEAD~1
  const diffFiles = await execGit(['diff', '--name-only', 'HEAD~1']);
  
  // 2. Para cada arquivo, pegar linhas alteradas
  // git diff -U0 HEAD~1 <file> | grep "^+"
  
  // 3. Cruzar com coverage.json
  
  // 4. Calcular % de linhas diff cobertas
}
```

Validar contra `targets.diff_coverage_min` e **falhar** se não atingir.

### 11. Scaffold Integration com Supertest + Testcontainers
**Prioridade: MÉDIA**

Atualizar `src/tools/scaffold-integration.ts`:

Adicionar templates:
```typescript
// Template supertest
const supertestTemplate = `
import request from 'supertest';
import { app } from '../../../src/server';

describe('{{ENDPOINT}}', () => {
  it('should return {{STATUS}}', async () => {
    const res = await request(app)
      .{{METHOD}}('{{PATH}}')
      .send({{PAYLOAD}});
    
    expect(res.status).toBe({{STATUS}});
  });
});
`;

// Template testcontainers
const testcontainersTemplate = `
import { GenericContainer } from 'testcontainers';

let container;

beforeAll(async () => {
  container = await new GenericContainer('postgres:15')
    .withExposedPorts(5432)
    .start();
});

afterAll(async () => {
  await container.stop();
});
`;
```

### 12. OpenAPI → Contratos Automáticos
**Prioridade: MÉDIA**

Criar `src/tools/generate-contracts.ts`:
```typescript
async function generateContractsFromOpenAPI(
  openApiPath: string,
  outputDir: string
): Promise<void> {
  // 1. Parse OpenAPI (swagger-parser)
  const api = await SwaggerParser.parse(openApiPath);
  
  // 2. Para cada endpoint, gerar teste de contrato
  for (const [path, methods] of Object.entries(api.paths)) {
    for (const [method, spec] of Object.entries(methods)) {
      // Gerar teste validando:
      // - Status codes esperados
      // - Schema de resposta
      // - Required fields
      // - Types
    }
  }
}
```

### 13. Melhorar Plan Tool com Score de Risco
**Prioridade: MÉDIA**

Atualizar `src/tools/plan.ts`:
```typescript
// Ordenar por score de risco
const sortedTasks = tasks.sort((a, b) => b.riskScore - a.riskScore);

// Adicionar TODOs automáticos
const todos: string[] = [];
if (!hasOpenAPISpec) {
  todos.push('[ ] TODO: Add OpenAPI spec for automatic contract generation');
}
if (!hasAuthFixtures) {
  todos.push('[ ] TODO: Create auth fixtures in fixtures/auth/');
}

// Adicionar gates explícitos
const gates = `
## Quality Gates

- ✅ Diff Coverage: ≥ ${targets.diff_coverage_min}%
- ✅ Flaky Tests: ≤ ${targets.flaky_pct_max}%
- ✅ CI P95: ≤ ${targets.ci_p95_min} min
`;
```

### 14. Registrar init-product no Server
**Prioridade: ALTA**

Em `src/server.ts`:
```typescript
import { initProduct } from './tools/init-product.js';

// Adicionar no ListToolsRequestSchema:
{
  name: 'init_product',
  description: 'Initializes QA structure for a product',
  inputSchema: {
    type: 'object',
    properties: {
      repo: { type: 'string' },
      product: { type: 'string' },
      base_url: { type: 'string' },
      domains: { type: 'array', items: { type: 'string' } },
      critical_flows: { type: 'array', items: { type: 'string' } }
    },
    required: ['repo', 'product', 'base_url']
  }
}

// Adicionar no CallToolRequestSchema switch:
case 'init_product': {
  const params = InitProductSchema.parse(request.params.arguments);
  const result = await initProduct(params);
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
}
```

## 📋 Resumo de Prioridades

### Sprint 1 (Esta semana)
1. ✅ ~~Configuração centralizada~~ (DONE)
2. ✅ ~~Idempotência~~ (DONE)
3. ✅ ~~Playwright boas práticas~~ (DONE)
4. ✅ ~~Init product tool~~ (DONE)
5. ✅ ~~GETTING_STARTED template~~ (DONE)

### Sprint 2 (Próxima semana)
6. [ ] Integrar config em todas as tools
7. [ ] Validações Zod robustas
8. [ ] Registrar init-product no server
9. [ ] Diff-coverage implementation
10. [ ] Tests para novas funcionalidades

### Sprint 3 (Semana seguinte)
11. [ ] Sistema de risco probabilístico
12. [ ] Melhorar scaffold-integration (supertest)
13. [ ] OpenAPI → contratos
14. [ ] Melhorar plan tool com scores

## 🧪 Testes Necessários

Criar testes para:
- [ ] `src/utils/config.ts` - loadMCPSettings, mergeSettings
- [ ] `src/utils/fs.ts` - writeFileSafe com backup
- [ ] `src/tools/init-product.ts` - criação de estrutura

## 📖 Documentação

Atualizar:
- [ ] `README.md` - adicionar seção sobre mcp-settings.json
- [ ] `QUICKSTART.md` - incluir comando init-product
- [ ] `docs/RECOMMENDATION-FEATURE.md` - documentar sistema de risco

## ✅ Como Usar (Já Disponível)

```bash
# 1. Compilar
npm run build

# 2. Criar estrutura de produto (novo!)
quality init-product --repo /path/to/repo --product ReclameAQUI --base-url https://www.reclameaqui.com.br

# 3. Customizar mcp-settings.json
# Editar /qa/ReclameAQUI/mcp-settings.json

# 4. Seguir fluxo normal
quality analyze --repo . --product ReclameAQUI
# A tool vai automaticamente ler as configs de mcp-settings.json
```

---

**Status:** Fase 1 completa (6/14 itens)  
**Próximo:** Integrar config nas tools existentes  
**Data:** 2025-11-01

import { writeFileSafe, join, readFile, fileExists } from '../utils/fs.js';
import type { AnalyzeResult } from './analyze.js';

export interface PlanParams {
  repo: string;
  analyze_result?: AnalyzeResult;
  product: string;
  base_url: string;
  include_examples?: boolean;
  out_dir: string;
}

export async function generatePlan(input: PlanParams): Promise<{ ok: boolean; plan: string }> {
  console.log(`📋 Gerando plano de testes para ${input.product}...`);

  // Tenta carregar resultado da análise se não foi passado
  let analyzeData: AnalyzeResult | undefined = input.analyze_result;
  
  if (!analyzeData) {
    const analyzePath = join(input.repo, 'plan', 'analyze.json');
    if (await fileExists(analyzePath)) {
      const content = await readFile(analyzePath);
      analyzeData = JSON.parse(content);
    }
  }

  const criticalRoutes = analyzeData?.findings.risk_map
    .filter(r => r.risk === 'high')
    .map(r => r.area)
    .slice(0, 5) || [];

  const md = `# Plano de Testes E2E — ${input.product}

**Base URL:** ${input.base_url}

**Data:** ${new Date().toISOString().split('T')[0]}

## 1) Cenários Canônicos (Produto)

${criticalRoutes.length > 0 ? `### Rotas Críticas Detectadas
${criticalRoutes.map(r => `- ${r}`).join('\n')}
` : ''}

### Cenários Principais
- **Login e Sessão** (P1) — owner: QA Consumer — SLA: 7 dias
  - Login com credenciais válidas
  - Persistência de sessão
  - Logout
  - Login com credenciais inválidas (caso negativo)

- **Abrir Reclamação** (P1) — owner: QA Consumer — SLA: 7 dias
  - Fluxo completo de abertura
  - Validação de campos obrigatórios
  - Upload de anexos
  - Confirmação de criação

- **Buscar Empresa** (P2) — owner: QA Search — SLA: 14 dias
  - Busca com resultados
  - Busca sem resultados
  - Filtros e ordenação

## 2) Risco & Priorização

- **P1 (Alta Prioridade):** Caminho do dinheiro, incidentes recorrentes, SLA regulatório
- **P2 (Média Prioridade):** Alta frequência de uso, impacto moderado
- **P3 (Baixa Prioridade):** Funcionalidades secundárias, baixo impacto

${analyzeData ? `
### Mapa de Riscos (Análise)
${analyzeData.findings.risk_map.slice(0, 10).map(r => 
  `- **[${r.risk.toUpperCase()}]** ${r.area}: ${r.rationale}`
).join('\n')}
` : ''}

## 3) Playwright — Estrutura

\`\`\`
packages/product-e2e/
├─ playwright.config.ts
├─ fixtures/
│  ├─ auth.ts
│  └─ test-data.ts
└─ tests/
   ├─ auth/
   │  ├─ login.spec.ts
   │  └─ session.spec.ts
   ├─ claim/
   │  ├─ open-claim.spec.ts
   │  └─ claim-validation.spec.ts
   └─ search/
      ├─ search-company.spec.ts
      └─ search-filters.spec.ts
\`\`\`

## 4) Dados de Teste

- **Ambiente:** Staging/Preview
- **Usuário seed:** Configurado via variáveis de ambiente (E2E_USER, E2E_PASS)
- **Massa sintética:** Factories determinísticas para dados de teste
- **Limpeza:** Reset de dados após cada suite (quando aplicável)

## 5) Relatórios & Métricas

### Formatos de Saída
- **HTML:** Relatório visual interativo
- **JUnit XML:** Integração com CI/CD
- **JSON:** Análise programática
- **Coverage (lcov):** Cobertura de código

### Políticas de Qualidade
- **Flaky Tests:** Quarentena automática + issue + SLA 7 dias para correção
- **Retry Policy:** 1 retry automático, máximo 2 tentativas
- **Timeout:** 35s por teste, 5min por suite

### Metas (Targets)
- **CI p95:** ≤ 15 minutos (percentil 95 do tempo de CI)
- **Flaky Rate:** ≤ 3% (percentual de testes instáveis)
- **Diff Coverage:** ≥ 60% (cobertura nas mudanças)

## 6) Execução

### Ambientes
- **PR:** Suite reduzida (smoke tests)
- **Nightly:** Suite completa
- **Pre-release:** Suite completa + testes de regressão

### Comandos
\`\`\`bash
# Executar todos os testes
npm run e2e

# Executar por domínio
npm run e2e:auth
npm run e2e:claim
npm run e2e:search

# Debug mode
npm run e2e:debug

# Gerar relatório
npm run e2e:report
\`\`\`

${input.include_examples ? `
## Apêndice: Exemplos de Testes

### Exemplo 1: Login
\`\`\`typescript
import { test, expect } from '@playwright/test';

test.describe('Autenticação', () => {
  test('deve fazer login com credenciais válidas', async ({ page }) => {
    await page.goto(process.env.E2E_BASE_URL!);
    
    await page.getByLabel('Email').fill(process.env.E2E_USER!);
    await page.getByLabel('Senha').fill(process.env.E2E_PASS!);
    await page.getByRole('button', { name: 'Entrar' }).click();
    
    await expect(page.getByText('Bem-vindo')).toBeVisible();
    await expect(page.url()).toContain('/dashboard');
  });

  test('deve mostrar erro com credenciais inválidas', async ({ page }) => {
    await page.goto(process.env.E2E_BASE_URL!);
    
    await page.getByLabel('Email').fill('invalido@teste.com');
    await page.getByLabel('Senha').fill('senhaerrada');
    await page.getByRole('button', { name: 'Entrar' }).click();
    
    await expect(page.getByText(/credenciais inválidas/i)).toBeVisible();
  });
});
\`\`\`

### Exemplo 2: Abertura de Reclamação
\`\`\`typescript
import { test, expect } from '@playwright/test';

test.describe('Reclamação', () => {
  test.use({ storageState: 'auth.json' }); // Reusa sessão autenticada

  test('deve abrir nova reclamação', async ({ page }) => {
    await page.goto('/reclamacoes/nova');
    
    await page.getByLabel(/empresa/i).fill('Acme Corp');
    await page.getByLabel(/assunto/i).fill('Produto com defeito');
    await page.getByLabel(/descrição/i).fill('Descrição detalhada do problema...');
    
    await page.getByRole('button', { name: /enviar/i }).click();
    
    await expect(page.getByText(/reclamação criada com sucesso/i)).toBeVisible();
    await expect(page.getByText(/protocolo/i)).toBeVisible();
  });
});
\`\`\`

### Exemplo 3: Busca de Empresa
\`\`\`typescript
import { test, expect } from '@playwright/test';

test.describe('Busca', () => {
  test('deve buscar e encontrar empresa', async ({ page }) => {
    await page.goto('/busca');
    
    await page.getByLabel(/buscar empresa/i).fill('Acme');
    await page.keyboard.press('Enter');
    
    await expect(page.getByRole('heading', { name: /resultados/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /acme/i })).toBeVisible();
  });

  test('deve mostrar mensagem quando não encontrar resultados', async ({ page }) => {
    await page.goto('/busca');
    
    await page.getByLabel(/buscar empresa/i).fill('XYZ123NaoExiste');
    await page.keyboard.press('Enter');
    
    await expect(page.getByText(/nenhum resultado encontrado/i)).toBeVisible();
  });
});
\`\`\`
` : ''}

## 7) Manutenção & Evolução

- **Review mensal:** Atualizar cenários conforme novas funcionalidades
- **Refatoração:** Extrair page objects quando houver duplicação
- **Monitoramento:** Acompanhar métricas de flaky e tempo de execução
- **Feedback:** Loop com time de desenvolvimento para melhorar testabilidade

---

**Próximos Passos:**
1. ✅ Plano aprovado por QA
2. ⏳ Scaffold dos testes (executar \`quality scaffold\`)
3. ⏳ Execução e validação (executar \`quality run\`)
4. ⏳ Relatório para release (executar \`quality report\`)
`;

  const out = join(input.repo, input.out_dir, 'TEST-PLAN.md');
  await writeFileSafe(out, md);
  
  console.log(`✅ Plano gerado: ${out}`);
  
  return { ok: true, plan: out };
}


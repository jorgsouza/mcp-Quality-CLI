// src/tools/recommend-strategy.ts
import { join } from 'node:path';
import { readdir, stat, readFile } from 'node:fs/promises';
import { writeFileSafe } from '../utils/fs.js';

interface AppCharacteristics {
  hasWebUI: boolean;
  hasBackendAPI: boolean;
  hasDatabase: boolean;
  hasAuth: boolean;
  hasExternalIntegrations: boolean;
  isCLI: boolean;
  isMCPServer: boolean;
  isLibrary: boolean;
  complexity: 'low' | 'medium' | 'high';
  appType: string;
}

interface TestStrategy {
  unitPct: number;
  integrationPct: number;
  e2ePct: number;
  unitCount: string;
  integrationCount: string;
  e2eCount: string;
  reasoning: string[];
  priorities: Array<{
    file: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    reason: string;
  }>;
}

/**
 * Detecta características da aplicação analisando o código
 */
async function detectAppCharacteristics(repo: string): Promise<AppCharacteristics> {
  const characteristics: AppCharacteristics = {
    hasWebUI: false,
    hasBackendAPI: false,
    hasDatabase: false,
    hasAuth: false,
    hasExternalIntegrations: false,
    isCLI: false,
    isMCPServer: false,
    isLibrary: false,
    complexity: 'low',
    appType: 'unknown'
  };

  try {
    // Verificar package.json
    const pkgPath = join(repo, 'package.json');
    const pkgContent = await readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgContent);

    // Detectar CLI
    if (pkg.bin || pkgContent.includes('commander') || pkgContent.includes('yargs')) {
      characteristics.isCLI = true;
    }

    // Detectar MCP Server
    if (pkgContent.includes('@modelcontextprotocol/sdk')) {
      characteristics.isMCPServer = true;
    }

    // Detectar Web UI (React, Next.js, Vue, Angular)
    const webFrameworks = ['react', 'next', 'vue', 'angular', '@angular', 'svelte'];
    if (webFrameworks.some(fw => pkgContent.includes(`"${fw}"`) || pkgContent.includes(`"@${fw}`))) {
      characteristics.hasWebUI = true;
    }

    // Detectar Backend API (Express, Fastify, Koa, NestJS)
    const backendFrameworks = ['express', 'fastify', 'koa', '@nestjs', 'hapi'];
    if (backendFrameworks.some(fw => pkgContent.includes(`"${fw}"`))) {
      characteristics.hasBackendAPI = true;
    }

    // Detectar Database
    const dbLibs = ['prisma', 'sequelize', 'typeorm', 'mongoose', 'knex', 'pg', 'mysql', 'mongodb'];
    if (dbLibs.some(lib => pkgContent.includes(`"${lib}"`))) {
      characteristics.hasDatabase = true;
    }

    // Detectar Auth
    const authLibs = ['passport', 'jsonwebtoken', 'bcrypt', 'next-auth', 'auth0', 'firebase'];
    if (authLibs.some(lib => pkgContent.includes(`"${lib}"`))) {
      characteristics.hasAuth = true;
    }

    // Detectar integrações externas
    const integrationLibs = ['axios', 'node-fetch', 'kafkajs', '@aws-sdk', 'redis', 'amqplib'];
    if (integrationLibs.some(lib => pkgContent.includes(`"${lib}"`))) {
      characteristics.hasExternalIntegrations = true;
    }

    // Detectar se é biblioteca
    if (pkg.main && !pkg.bin && !characteristics.hasWebUI) {
      characteristics.isLibrary = true;
    }

  } catch (err) {
    console.warn('Erro ao analisar package.json:', err);
  }

  // Determinar complexidade
  const complexityScore = [
    characteristics.hasWebUI,
    characteristics.hasBackendAPI,
    characteristics.hasDatabase,
    characteristics.hasAuth,
    characteristics.hasExternalIntegrations
  ].filter(Boolean).length;

  if (complexityScore >= 4) characteristics.complexity = 'high';
  else if (complexityScore >= 2) characteristics.complexity = 'medium';
  else characteristics.complexity = 'low';

  // Determinar tipo da aplicação
  if (characteristics.hasWebUI && characteristics.hasBackendAPI) {
    characteristics.appType = 'Full-stack Web App';
  } else if (characteristics.hasWebUI) {
    characteristics.appType = 'Frontend Web App';
  } else if (characteristics.hasBackendAPI) {
    characteristics.appType = 'Backend API';
  } else if (characteristics.isCLI && characteristics.isMCPServer) {
    characteristics.appType = 'CLI Tool + MCP Server';
  } else if (characteristics.isCLI) {
    characteristics.appType = 'CLI Tool';
  } else if (characteristics.isMCPServer) {
    characteristics.appType = 'MCP Server';
  } else if (characteristics.isLibrary) {
    characteristics.appType = 'Library/Package';
  } else {
    characteristics.appType = 'Generic Application';
  }

  return characteristics;
}

/**
 * Recomenda estratégia de testes baseado nas características
 */
function recommendStrategy(chars: AppCharacteristics): TestStrategy {
  // Estratégia padrão (web app tradicional)
  let strategy: TestStrategy = {
    unitPct: 70,
    integrationPct: 20,
    e2ePct: 10,
    unitCount: '50-100',
    integrationCount: '15-30',
    e2eCount: '5-15',
    reasoning: [],
    priorities: []
  };

  // Ajustar baseado no tipo de aplicação
  if (chars.isCLI || chars.isMCPServer || chars.isLibrary) {
    // CLI/Library: Muito mais unit, pouco integration, zero E2E
    strategy.unitPct = 90;
    strategy.integrationPct = 10;
    strategy.e2ePct = 0;
    strategy.unitCount = '40-60';
    strategy.integrationCount = '5-10';
    strategy.e2eCount = '0-2';
    
    strategy.reasoning.push(
      '✅ Aplicação CLI/Tool/Library - lógica determinística',
      '✅ Não tem UI complexa que justifique E2E',
      '✅ Fácil de testar manualmente em segundos',
      '✅ Unit tests cobrem 90%+ dos bugs possíveis',
      '❌ E2E seria overkill e caro de manter'
    );
  } else if (chars.hasWebUI && chars.complexity === 'high') {
    // Web app complexo: Pirâmide tradicional
    strategy.unitPct = 60;
    strategy.integrationPct = 25;
    strategy.e2ePct = 15;
    strategy.unitCount = '100-200';
    strategy.integrationCount = '30-50';
    strategy.e2eCount = '15-30';
    
    strategy.reasoning.push(
      '✅ Web app complexo - múltiplas camadas',
      '✅ UI crítica - E2E necessário para fluxos principais',
      '✅ Integrações complexas justificam testes de integração',
      '⚠️ Balance entre velocidade (unit) e confiança (E2E)'
    );
  } else if (chars.hasBackendAPI && !chars.hasWebUI) {
    // Backend API: Mais integration, menos E2E
    strategy.unitPct = 70;
    strategy.integrationPct = 25;
    strategy.e2ePct = 5;
    strategy.unitCount = '60-120';
    strategy.integrationCount = '20-40';
    strategy.e2eCount = '3-8';
    
    strategy.reasoning.push(
      '✅ Backend API - foco em contratos e integrações',
      '✅ Integration tests para endpoints críticos',
      '✅ E2E apenas para fluxos multi-endpoint',
      '⚠️ Contract testing (CDC) recomendado'
    );
  } else if (chars.hasWebUI && chars.complexity === 'low') {
    // Frontend simples
    strategy.unitPct = 75;
    strategy.integrationPct = 15;
    strategy.e2ePct = 10;
    strategy.unitCount = '40-80';
    strategy.integrationCount = '10-20';
    strategy.e2eCount = '5-10';
    
    strategy.reasoning.push(
      '✅ Frontend web - componentes isolados',
      '✅ Unit tests para lógica de componentes',
      '✅ E2E para fluxos críticos de usuário',
      '⚠️ Smoke tests suficientes para E2E'
    );
  }

  return strategy;
}

/**
 * Identifica arquivos prioritários para testes
 */
async function identifyPriorities(
  repo: string, 
  chars: AppCharacteristics
): Promise<Array<{ file: string; priority: 'HIGH' | 'MEDIUM' | 'LOW'; reason: string }>> {
  const priorities: Array<{ file: string; priority: 'HIGH' | 'MEDIUM' | 'LOW'; reason: string }> = [];

  try {
    // Padrões de arquivos críticos
    const criticalPatterns = [
      { pattern: /detector|parser|analyzer/i, priority: 'HIGH' as const, reason: 'Lógica complexa de parsing' },
      { pattern: /auth|security|permission/i, priority: 'HIGH' as const, reason: 'Segurança crítica' },
      { pattern: /payment|billing|transaction/i, priority: 'HIGH' as const, reason: 'Lógica financeira' },
      { pattern: /util|helper|lib/i, priority: 'MEDIUM' as const, reason: 'Funções utilitárias reutilizadas' },
      { pattern: /config|setup/i, priority: 'LOW' as const, reason: 'Configuração simples' },
    ];

    // Buscar arquivos .ts/.js recursivamente
    const files: string[] = [];
    async function scan(dir: string) {
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await scan(fullPath);
          } else if (entry.isFile() && /\.(ts|js)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
            files.push(fullPath.replace(repo + '/', ''));
          }
        }
      } catch (err) {
        // Ignorar erros de permissão
      }
    }

    await scan(join(repo, 'src'));

    // Classificar arquivos por prioridade
    for (const file of files.slice(0, 20)) { // Limitar a 20 arquivos mais importantes
      for (const { pattern, priority, reason } of criticalPatterns) {
        if (pattern.test(file)) {
          priorities.push({ file, priority, reason });
          break;
        }
      }
      
      // Se não matchou nenhum padrão, é baixa prioridade
      if (!priorities.find(p => p.file === file)) {
        priorities.push({ file, priority: 'LOW', reason: 'Arquivo genérico' });
      }
    }

  } catch (err) {
    console.warn('Erro ao identificar prioridades:', err);
  }

  return priorities.sort((a, b) => {
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return order[a.priority] - order[b.priority];
  });
}

/**
 * Gera o documento de recomendação estratégica
 */
function generateStrategyDocument(
  product: string,
  chars: AppCharacteristics,
  strategy: TestStrategy,
  currentCoverage?: { unit: number; integration: number; e2e: number }
): string {
  const hasIcon = (condition: boolean) => condition ? '✅' : '❌';
  
  return `# 🎯 Recomendação de Estratégia de Testes - ${product}

**Análise realizada por:** Quality MCP  
**Data:** ${new Date().toISOString().split('T')[0]}  
**Tipo de aplicação:** ${chars.appType}

---

## 📋 Características da Aplicação

**${product} é:**

- ${hasIcon(chars.hasWebUI)} Aplicação web com UI
- ${hasIcon(chars.hasBackendAPI)} Backend API
- ${hasIcon(chars.hasDatabase)} Sistema com banco de dados
- ${hasIcon(chars.hasAuth)} Sistema com autenticação
- ${hasIcon(chars.hasExternalIntegrations)} Integrações externas
- ${hasIcon(chars.isCLI)} Ferramenta CLI
- ${hasIcon(chars.isMCPServer)} MCP Server
- ${hasIcon(chars.isLibrary)} Biblioteca/Package

**Complexidade:** ${chars.complexity.toUpperCase()}

---

## 🎯 Estratégia Recomendada

### Proporção de Testes

\`\`\`
┌─────────────────────────────────────────┐
│     PIRÂMIDE RECOMENDADA - ${product.toUpperCase()}     │
└─────────────────────────────────────────┘

${strategy.e2ePct === 0 ? '     ⬜ E2E (0% - pular)' : `       /\\\\ E2E ${strategy.e2ePct}%`}
${strategy.e2ePct > 0 ? '      ────────' : '     ────────'}
     /  INT   \\     ${strategy.integrationPct}%
    ───────────
   /   UNIT    \\    ${strategy.unitPct}%
  ───────────────
\`\`\`

### Distribuição Recomendada

| Camada          | Quantidade           | % | Prioridade |
| --------------- | -------------------- | --- | ---------- |
| **Unit**        | ${strategy.unitCount} testes | ${strategy.unitPct}% | ${strategy.unitPct >= 70 ? '🔴 ALTA' : '🟡 MÉDIA'} |
| **Integration** | ${strategy.integrationCount} testes | ${strategy.integrationPct}% | ${strategy.integrationPct >= 20 ? '🟡 MÉDIA' : '🟢 BAIXA'} |
| **E2E**         | ${strategy.e2eCount} testes | ${strategy.e2ePct}% | ${strategy.e2ePct >= 10 ? '🟡 MÉDIA' : strategy.e2ePct > 0 ? '🟢 BAIXA' : '⬜ PULE'} |

---

## 💡 Justificativa

${strategy.reasoning.map(r => `- ${r}`).join('\n')}

---

## 📊 ROI (Return on Investment)

| Tipo        | Tempo/Teste | Tempo Manutenção | Cobertura de Bugs | Recomendação |
| ----------- | ----------- | ---------------- | ----------------- | ------------ |
| **Unit**        | 5-10 min    | Baixo            | ${strategy.unitPct >= 80 ? '90%+' : '70-80%'}           | ${strategy.unitPct >= 70 ? '✅ ALTA' : '⚠️ MÉDIA'} |
| **Integration** | 15-30 min   | Médio            | ${strategy.integrationPct >= 20 ? '10-15%' : '5-10%'}          | ${strategy.integrationPct >= 20 ? '⚠️ MÉDIA' : '🟢 BAIXA'} |
| **E2E**         | 1-2 horas   | Alto             | ${strategy.e2ePct >= 10 ? '5-10%' : '0-5%'}            | ${strategy.e2ePct >= 10 ? '⚠️ MÉDIA' : strategy.e2ePct > 0 ? '🟢 BAIXA' : '❌ PULE'} |

${currentCoverage ? `
---

## 📈 Situação Atual vs Recomendada

### Atual
\`\`\`
Unit:        ${currentCoverage.unit} testes (${Math.round((currentCoverage.unit / (currentCoverage.unit + currentCoverage.integration + currentCoverage.e2e || 1)) * 100)}%)
Integration: ${currentCoverage.integration} testes (${Math.round((currentCoverage.integration / (currentCoverage.unit + currentCoverage.integration + currentCoverage.e2e || 1)) * 100)}%)
E2E:         ${currentCoverage.e2e} testes (${Math.round((currentCoverage.e2e / (currentCoverage.unit + currentCoverage.integration + currentCoverage.e2e || 1)) * 100)}%)
\`\`\`

### Recomendada
\`\`\`
Unit:        ${strategy.unitCount} testes (${strategy.unitPct}%)
Integration: ${strategy.integrationCount} testes (${strategy.integrationPct}%)
E2E:         ${strategy.e2eCount} testes (${strategy.e2ePct}%)
\`\`\`
` : ''}

---

## 🎯 Arquivos Prioritários para Testes

${strategy.priorities.slice(0, 10).map((p, i) => `
### ${i + 1}. \`${p.file}\` ${p.priority === 'HIGH' ? '🔴' : p.priority === 'MEDIUM' ? '🟡' : '🟢'}

**Prioridade:** ${p.priority}  
**Motivo:** ${p.reason}
`).join('\n')}

---

## 📋 Plano de Ação

### Fase 1: Testes Unitários ${strategy.unitPct >= 70 ? '(CRÍTICO)' : '(IMPORTANTE)'}

**Tempo estimado:** ${strategy.unitPct >= 80 ? '3-5 dias' : '2-3 dias'}

1. Gerar estrutura de testes para arquivos prioritários
   \`\`\`bash
   quality scaffold-unit --repo . --framework vitest
   \`\`\`

2. Implementar casos de teste para os ${strategy.priorities.filter(p => p.priority === 'HIGH').length} arquivos de ALTA prioridade

3. Executar e verificar cobertura
   \`\`\`bash
   npm test
   npm run test:coverage
   \`\`\`

**Meta:** ${strategy.unitCount} testes, 70%+ cobertura

### Fase 2: Testes de Integração ${strategy.integrationPct >= 20 ? '(IMPORTANTE)' : '(OPCIONAL)'}

**Tempo estimado:** ${strategy.integrationPct >= 20 ? '2-3 dias' : '1 dia'}

${strategy.integrationPct >= 20 ? `
1. Gerar estrutura de integração
   \`\`\`bash
   quality scaffold-integration --repo . --product "${product}"
   \`\`\`

2. Implementar testes para fluxos críticos multi-camada

3. Configurar contract testing (CDC) se aplicável
` : `
1. ${strategy.integrationCount} testes básicos para fluxos principais
2. Apenas se sobrar tempo após completar unit tests
`}

### Fase 3: Testes E2E ${strategy.e2ePct >= 10 ? '(IMPORTANTE)' : strategy.e2ePct > 0 ? '(OPCIONAL)' : '(PULE)'}

${strategy.e2ePct >= 10 ? `
**Tempo estimado:** 3-5 dias

1. Gerar plano e scaffold Playwright
   \`\`\`bash
   quality analyze --repo . --product "${product}"
   quality scaffold --repo . --plan plan/TEST-PLAN.md
   \`\`\`

2. Implementar cenários críticos (P1)

3. Configurar CI/CD para executar E2E
` : strategy.e2ePct > 0 ? `
**Tempo estimado:** 1-2 dias

- Apenas smoke tests para fluxos críticos
- Considere teste manual para economizar tempo
` : `
**❌ PULE E2E COMPLETAMENTE**

Para este tipo de aplicação, E2E não traz valor suficiente.

**Alternativa:** Teste manual rápido (30 segundos)
\`\`\`bash
# Validação manual suficiente
npm start
# Testar principais funcionalidades manualmente
\`\`\`
`}

---

## 🎊 Resumo Executivo

### TL;DR

**Para ${product} (${chars.appType}):**

1. ${strategy.unitPct >= 70 ? '✅' : '⚠️'} **FOCO EM UNIT TESTS** - ${strategy.unitPct}% (${strategy.unitCount} testes)
2. ${strategy.integrationPct >= 20 ? '⚠️' : '🟢'} **INTEGRATION TESTS** - ${strategy.integrationPct}% (${strategy.integrationCount} testes) ${strategy.integrationPct < 10 ? '- Opcional' : ''}
3. ${strategy.e2ePct >= 10 ? '⚠️' : strategy.e2ePct > 0 ? '🟢' : '❌'} **E2E TESTS** - ${strategy.e2ePct}% (${strategy.e2eCount} testes) ${strategy.e2ePct === 0 ? '- Pule!' : strategy.e2ePct < 10 ? '- Apenas smoke tests' : ''}

### Por Quê?

${chars.appType} tem características que justificam uma pirâmide **${strategy.unitPct >= 80 ? 'muito focada em unit tests' : strategy.e2ePct >= 15 ? 'balanceada com E2E significativo' : 'tradicional com foco em unit/integration'}**.

**Priorize:** ${strategy.priorities.filter(p => p.priority === 'HIGH').length} arquivos de alta prioridade primeiro!

---

**Gerado automaticamente por:** Quality MCP v0.2.0  
**Documento:** tests/analyses/TEST-STRATEGY-RECOMMENDATION.md
`;
}

/**
 * Tool principal: Recomenda estratégia de testes
 */
export async function recommendTestStrategy(input: {
  repo: string;
  product: string;
  auto_generate?: boolean; // Se true, gera automaticamente sem perguntar
}): Promise<any> {
  console.log(`\n🔍 Analisando ${input.product}...`);
  
  // 1. Detectar características da aplicação
  const chars = await detectAppCharacteristics(input.repo);
  
  console.log(`\n📊 Tipo detectado: ${chars.appType}`);
  console.log(`📊 Complexidade: ${chars.complexity.toUpperCase()}`);
  
  // 2. Recomendar estratégia
  const strategy = recommendStrategy(chars);
  
  // 3. Identificar arquivos prioritários
  strategy.priorities = await identifyPriorities(input.repo, chars);
  
  // 4. Tentar ler cobertura atual (se existir)
  let currentCoverage: { unit: number; integration: number; e2e: number } | undefined;
  try {
    const coverageFile = join(input.repo, 'tests/analyses/coverage-analysis.json');
    const coverageData = JSON.parse(await readFile(coverageFile, 'utf-8'));
    currentCoverage = {
      unit: coverageData.pyramid?.unit?.files_found || 0,
      integration: coverageData.pyramid?.integration?.files_found || 0,
      e2e: coverageData.pyramid?.e2e?.files_found || 0
    };
  } catch {
    // Sem cobertura atual
  }
  
  // 5. Gerar documento
  const document = generateStrategyDocument(input.product, chars, strategy, currentCoverage);
  
  // 6. Verificar se já existe
  const outputPath = join(input.repo, 'tests/analyses/TEST-STRATEGY-RECOMMENDATION.md');
  let shouldGenerate = input.auto_generate ?? false;
  
  try {
    await readFile(outputPath, 'utf-8');
    // Arquivo já existe
    if (!input.auto_generate) {
      console.log(`\n⚠️  Arquivo já existe: ${outputPath}`);
      console.log(`\n📝 RECOMENDAÇÃO:`);
      console.log(`   Unit:        ${strategy.unitPct}% (${strategy.unitCount} testes)`);
      console.log(`   Integration: ${strategy.integrationPct}% (${strategy.integrationCount} testes)`);
      console.log(`   E2E:         ${strategy.e2ePct}% (${strategy.e2eCount} testes)`);
      console.log(`\n${strategy.reasoning.map(r => `   ${r}`).join('\n')}`);
      
      return {
        ok: true,
        exists: true,
        file: outputPath,
        recommendation: {
          appType: chars.appType,
          complexity: chars.complexity,
          strategy: {
            unit: `${strategy.unitPct}% (${strategy.unitCount})`,
            integration: `${strategy.integrationPct}% (${strategy.integrationCount})`,
            e2e: `${strategy.e2ePct}% (${strategy.e2eCount})`
          },
          reasoning: strategy.reasoning,
          priorities: strategy.priorities.slice(0, 5)
        },
        message: '⚠️  Documento já existe. Use --force para sobrescrever ou --auto-generate para gerar automaticamente.'
      };
    }
    shouldGenerate = true;
  } catch {
    // Arquivo não existe, pode gerar
    shouldGenerate = true;
  }
  
  if (shouldGenerate) {
    await writeFileSafe(outputPath, document);
    console.log(`\n✅ Recomendação estratégica gerada!`);
    console.log(`📄 ${outputPath}`);
    console.log(`\n📝 RECOMENDAÇÃO:`);
    console.log(`   Unit:        ${strategy.unitPct}% (${strategy.unitCount} testes) ${strategy.unitPct >= 70 ? '🔴 ALTA' : '🟡'}`);
    console.log(`   Integration: ${strategy.integrationPct}% (${strategy.integrationCount} testes) ${strategy.integrationPct >= 20 ? '🟡 MÉDIA' : '🟢 BAIXA'}`);
    console.log(`   E2E:         ${strategy.e2ePct}% (${strategy.e2eCount} testes) ${strategy.e2ePct >= 10 ? '🟡 MÉDIA' : strategy.e2ePct > 0 ? '🟢 BAIXA' : '⬜ PULE'}`);
    
    return {
      ok: true,
      file: outputPath,
      recommendation: {
        appType: chars.appType,
        complexity: chars.complexity,
        strategy: {
          unit: `${strategy.unitPct}% (${strategy.unitCount})`,
          integration: `${strategy.integrationPct}% (${strategy.integrationCount})`,
          e2e: `${strategy.e2ePct}% (${strategy.e2eCount})`
        },
        reasoning: strategy.reasoning,
        priorities: strategy.priorities.slice(0, 10)
      }
    };
  }
  
  return {
    ok: false,
    message: 'Geração cancelada pelo usuário'
  };
}


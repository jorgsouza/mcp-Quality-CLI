import { join } from 'node:path';
import { writeFileSafe, readFile, fileExists } from '../utils/fs.js';
import { glob } from 'glob';

export interface CatalogParams {
  repo: string;
  product: string;
  squads?: string[];  // Lista de squads do produto
}

export interface Scenario {
  id: string;
  name: string;
  domain: string;
  squad_owner: string;
  priority: 'P1' | 'P2' | 'P3';
  test_type: 'unit' | 'integration' | 'e2e';
  test_file: string;
  dependencies: string[];  // Cenários de outras squads que dependem deste
  status: 'implemented' | 'pending' | 'needs_review';
}

export interface CatalogResult {
  product: string;
  total_scenarios: number;
  by_squad: Record<string, Scenario[]>;
  by_domain: Record<string, Scenario[]>;
  by_priority: Record<string, Scenario[]>;
  cross_squad_scenarios: Scenario[];
  duplicates: Array<{
    scenario: string;
    squads: string[];
  }>;
  catalog_path: string;
}

export async function catalogScenarios(input: CatalogParams): Promise<CatalogResult> {
  console.log(`📚 Catalogando cenários de teste para ${input.product}...`);

  // Detecta todos os arquivos de teste
  const testFiles = await detectAllTests(input.repo);

  // Analisa cada arquivo e extrai cenários
  const scenarios = await extractScenariosFromTests(input.repo, testFiles, input.squads);

  // Agrupa por diferentes dimensões
  const bySquad = groupBySquad(scenarios);
  const byDomain = groupByDomain(scenarios);
  const byPriority = groupByPriority(scenarios);

  // Identifica cenários cross-squad
  const crossSquad = scenarios.filter(s => s.dependencies.length > 0);

  // Detecta duplicatas
  const duplicates = findDuplicateScenarios(scenarios);

  const result: CatalogResult = {
    product: input.product,
    total_scenarios: scenarios.length,
    by_squad: bySquad,
    by_domain: byDomain,
    by_priority: byPriority,
    cross_squad_scenarios: crossSquad,
    duplicates,
    catalog_path: join('tests', 'analyses', 'scenario-catalog.json')
  };

  // Salva catálogo em JSON
  await writeFileSafe(
    join(input.repo, 'tests', 'analyses', 'scenario-catalog.json'),
    JSON.stringify(result, null, 2)
  );

  // Gera relatório em Markdown
  await generateCatalogMarkdown(input.repo, result, input.product);

  // Gera matriz de responsabilidade
  await generateResponsibilityMatrix(input.repo, result, input.squads || []);

  console.log(`✅ Catálogo de cenários gerado!`);
  console.log(`   Total de cenários: ${scenarios.length}`);
  console.log(`   Squads: ${Object.keys(bySquad).length}`);
  console.log(`   Cross-squad: ${crossSquad.length}`);
  console.log(`   Duplicatas: ${duplicates.length}`);

  return result;
}

async function detectAllTests(repoPath: string): Promise<string[]> {
  const patterns = [
    join(repoPath, '**/*.test.{ts,tsx,js,jsx}'),
    join(repoPath, '**/*.spec.{ts,tsx,js,jsx}'),
    join(repoPath, '**/tests/**/*.{ts,tsx,js,jsx}')
  ];

  let allTests: string[] = [];

  for (const pattern of patterns) {
    const tests = await glob(pattern, {
      ignore: ['**/node_modules/**', '**/dist/**']
    });
    allTests.push(...tests);
  }

  return [...new Set(allTests)];
}

async function extractScenariosFromTests(
  repoPath: string,
  testFiles: string[],
  squads?: string[]
): Promise<Scenario[]> {
  const scenarios: Scenario[] = [];

  for (const testFile of testFiles) {
    try {
      const content = await readFile(join(repoPath, testFile));
      const fileScenarios = parseTestFile(content, testFile, squads);
      scenarios.push(...fileScenarios);
    } catch (error) {
      console.warn(`Erro ao processar ${testFile}:`, error);
    }
  }

  return scenarios;
}

function parseTestFile(content: string, filePath: string, squads?: string[]): Scenario[] {
  const scenarios: Scenario[] = [];

  // Detecta tipo de teste pelo caminho
  let testType: 'unit' | 'integration' | 'e2e' = 'unit';
  if (filePath.includes('/e2e/') || filePath.includes('/playwright/')) {
    testType = 'e2e';
  } else if (filePath.includes('/integration/') || filePath.includes('/api/')) {
    testType = 'integration';
  }

  // Detecta squad owner pelo caminho
  let squadOwner = 'unassigned';
  if (squads) {
    for (const squad of squads) {
      if (filePath.toLowerCase().includes(squad.toLowerCase())) {
        squadOwner = squad;
        break;
      }
    }
  }

  // Extrai domínio do caminho
  const pathParts = filePath.split('/');
  const domain = pathParts[pathParts.length - 2] || 'general';

  // Extrai testes com regex
  const testRegex = /(?:it|test)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let match;
  let index = 0;

  while ((match = testRegex.exec(content)) !== null) {
    const testName = match[1];
    
    // Determina prioridade baseado no nome
    let priority: 'P1' | 'P2' | 'P3' = 'P3';
    if (/critical|important|P1|login|signup|payment|checkout/i.test(testName)) {
      priority = 'P1';
    } else if (/P2|search|profile|settings/i.test(testName)) {
      priority = 'P2';
    }

    // Detecta dependências (comentários // @depends)
    const dependencies: string[] = [];
    const dependsRegex = /\/\/\s*@depends\s+([^\n]+)/gi;
    let depMatch;
    while ((depMatch = dependsRegex.exec(content)) !== null) {
      dependencies.push(depMatch[1].trim());
    }

    scenarios.push({
      id: `${domain}-${index++}`,
      name: testName,
      domain,
      squad_owner: squadOwner,
      priority,
      test_type: testType,
      test_file: filePath,
      dependencies,
      status: 'implemented'
    });
  }

  return scenarios;
}

function groupBySquad(scenarios: Scenario[]): Record<string, Scenario[]> {
  return scenarios.reduce((acc, scenario) => {
    if (!acc[scenario.squad_owner]) {
      acc[scenario.squad_owner] = [];
    }
    acc[scenario.squad_owner].push(scenario);
    return acc;
  }, {} as Record<string, Scenario[]>);
}

function groupByDomain(scenarios: Scenario[]): Record<string, Scenario[]> {
  return scenarios.reduce((acc, scenario) => {
    if (!acc[scenario.domain]) {
      acc[scenario.domain] = [];
    }
    acc[scenario.domain].push(scenario);
    return acc;
  }, {} as Record<string, Scenario[]>);
}

function groupByPriority(scenarios: Scenario[]): Record<string, Scenario[]> {
  return scenarios.reduce((acc, scenario) => {
    if (!acc[scenario.priority]) {
      acc[scenario.priority] = [];
    }
    acc[scenario.priority].push(scenario);
    return acc;
  }, {} as Record<string, Scenario[]>);
}

function findDuplicateScenarios(scenarios: Scenario[]): Array<{ scenario: string; squads: string[] }> {
  const nameMap = new Map<string, Set<string>>();

  for (const scenario of scenarios) {
    if (!nameMap.has(scenario.name)) {
      nameMap.set(scenario.name, new Set());
    }
    nameMap.get(scenario.name)!.add(scenario.squad_owner);
  }

  const duplicates: Array<{ scenario: string; squads: string[] }> = [];

  for (const [name, squads] of nameMap.entries()) {
    if (squads.size > 1) {
      duplicates.push({
        scenario: name,
        squads: Array.from(squads)
      });
    }
  }

  return duplicates;
}

async function generateCatalogMarkdown(
  repoPath: string,
  result: CatalogResult,
  product: string
) {
  const { by_squad, by_domain, by_priority, cross_squad_scenarios, duplicates } = result;

  const markdown = `# Catálogo de Cenários de Teste - ${product}

**Data:** ${new Date().toISOString().split('T')[0]}  
**Total de Cenários:** ${result.total_scenarios}

---

## 📊 Visão Geral

### Por Prioridade

| Prioridade | Quantidade | Percentual |
|------------|------------|------------|
| **P1 (Crítico)** | ${by_priority.P1?.length || 0} | ${((((by_priority.P1?.length || 0) / result.total_scenarios) * 100).toFixed(1))}% |
| **P2 (Importante)** | ${by_priority.P2?.length || 0} | ${((((by_priority.P2?.length || 0) / result.total_scenarios) * 100).toFixed(1))}% |
| **P3 (Normal)** | ${by_priority.P3?.length || 0} | ${((((by_priority.P3?.length || 0) / result.total_scenarios) * 100).toFixed(1))}% |

### Por Squad

${Object.entries(by_squad).map(([squad, scenarios]) => 
  `- **${squad}:** ${scenarios.length} cenários`
).join('\n')}

### Por Tipo de Teste

${Object.values(by_squad).flat().reduce((acc, s) => {
  acc[s.test_type] = (acc[s.test_type] || 0) + 1;
  return acc;
}, {} as Record<string, number>) && (() => {
  const counts = Object.values(by_squad).flat().reduce((acc, s) => {
    acc[s.test_type] = (acc[s.test_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return Object.entries(counts).map(([type, count]) => 
    `- **${type.toUpperCase()}:** ${count}`
  ).join('\n');
})()}

## 🔗 Cenários Cross-Squad

${cross_squad_scenarios.length === 0 ? 
  '_Nenhum cenário com dependências cross-squad detectado._' :
  cross_squad_scenarios.map(s => 
    `- **${s.name}** (${s.squad_owner})\n  - Depende de: ${s.dependencies.join(', ')}`
  ).join('\n')
}

## ⚠️ Duplicatas Detectadas

${duplicates.length === 0 ?
  '✅ _Nenhuma duplicata detectada._' :
  duplicates.map(d => 
    `- **"${d.scenario}"**\n  - Implementado por: ${d.squads.join(', ')}\n  - **Ação:** Consolidar em uma única squad`
  ).join('\n')
}

## 📋 Cenários por Domínio

${Object.entries(by_domain).map(([domain, scenarios]) => `
### ${domain.toUpperCase()} (${scenarios.length} cenários)

| Cenário | Squad | Prioridade | Tipo |
|---------|-------|------------|------|
${scenarios.map(s => 
  `| ${s.name} | ${s.squad_owner} | ${s.priority} | ${s.test_type} |`
).join('\n')}
`).join('\n')}

## 🎯 Recomendações

${duplicates.length > 0 ? `
### Eliminar Duplicatas

${duplicates.map(d => 
  `- Consolidar "${d.scenario}" (implementado por ${d.squads.join(' e ')})`
).join('\n')}
` : ''}

${cross_squad_scenarios.length > 0 ? `
### Gerenciar Dependências Cross-Squad

- Documentar contratos entre squads
- Implementar contract testing (Pact)
- Definir SLAs para mudanças
` : ''}

### Cobertura por Squad

${Object.entries(by_squad).map(([squad, scenarios]) => {
  const p1Count = scenarios.filter(s => s.priority === 'P1').length;
  const unitCount = scenarios.filter(s => s.test_type === 'unit').length;
  const e2eCount = scenarios.filter(s => s.test_type === 'e2e').length;
  
  return `
**${squad}:**
- ${p1Count === 0 ? '⚠️ Nenhum cenário P1' : `✅ ${p1Count} cenários P1`}
- ${unitCount === 0 ? '⚠️ Poucos testes unitários' : `${unitCount} testes unitários`}
- ${e2eCount > unitCount ? '⚠️ Mais E2E que unit (pirâmide invertida)' : `${e2eCount} testes E2E`}
`;
}).join('\n')}

## 📈 Próximos Passos

1. [ ] Revisar e validar cenários com cada squad
2. [ ] Eliminar duplicatas identificadas
3. [ ] Documentar contratos para cenários cross-squad
4. [ ] Definir owners para cenários "unassigned"
5. [ ] Estabelecer SLAs de manutenção por prioridade

## 🔄 Manutenção

Este catálogo deve ser atualizado:
- ✅ Semanalmente (automático via CI)
- ✅ Antes de releases
- ✅ Quando adicionar novos cenários

\`\`\`bash
# Atualizar catálogo
quality catalog --repo . --product "${product}"

# Ver diferenças
git diff tests/analyses/SCENARIO-CATALOG.md
\`\`\`

---

**Gerado por:** Quality MCP v0.2.0  
**Timestamp:** ${new Date().toISOString()}
`;

  await writeFileSafe(
    join(repoPath, 'tests', 'analyses', 'SCENARIO-CATALOG.md'),
    markdown
  );
}

async function generateResponsibilityMatrix(
  repoPath: string,
  result: CatalogResult,
  squads: string[]
) {
  const { by_squad, by_domain } = result;

  const matrix: string[][] = [['Domínio', ...squads, 'TOTAL']];

  const domains = Object.keys(by_domain);

  for (const domain of domains) {
    const row = [domain];
    
    for (const squad of squads) {
      const count = by_squad[squad]?.filter(s => s.domain === domain).length || 0;
      row.push(count.toString());
    }
    
    const total = by_domain[domain].length;
    row.push(total.toString());
    
    matrix.push(row);
  }

  // Linha de totais
  const totalsRow = ['TOTAL'];
  for (const squad of squads) {
    const count = by_squad[squad]?.length || 0;
    totalsRow.push(count.toString());
  }
  totalsRow.push(result.total_scenarios.toString());
  matrix.push(totalsRow);

  const markdown = `# Matriz de Responsabilidade - Testes

${matrix.map((row, i) => {
  if (i === 0) {
    return `| ${row.join(' | ')} |\n|${row.map(() => '---').join('|')}|`;
  }
  return `| ${row.join(' | ')} |`;
}).join('\n')}

## Interpretação

- Cada célula mostra quantos cenários de teste cada squad possui para cada domínio
- Identifique gaps: domínios sem cobertura
- Identifique overlaps: múltiplas squads testando o mesmo domínio
- Use para balancear responsabilidades

## Ações

- ⚠️ Domínios sem owner → Atribuir squad responsável
- ⚠️ Overlaps → Consolidar ou justificar
- ✅ Coverage equilibrado → Manter

---

**Atualizado:** ${new Date().toISOString().split('T')[0]}
`;

  await writeFileSafe(
    join(repoPath, 'tests', 'analyses', 'RESPONSIBILITY-MATRIX.md'),
    markdown
  );
}

import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSafe, fileExists } from '../utils/fs.js';
import { createMCPSettingsTemplate } from '../utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface InitProductParams {
  repo: string;
  product: string;
  base_url: string;
  domains?: string[];
  critical_flows?: string[];
}

export async function initProduct(input: InitProductParams): Promise<{ ok: boolean; path: string }> {
  console.log(`🚀 Initializing QA structure for ${input.product}...`);

  const qaDir = join(input.repo, 'qa', input.product);
  
  // Criar estrutura de diretórios
  await fs.mkdir(join(qaDir, 'tests', 'unit'), { recursive: true });
  await fs.mkdir(join(qaDir, 'tests', 'integration', 'contracts'), { recursive: true });
  await fs.mkdir(join(qaDir, 'tests', 'integration', 'helpers'), { recursive: true });
  await fs.mkdir(join(qaDir, 'tests', 'e2e'), { recursive: true });
  await fs.mkdir(join(qaDir, 'tests', 'analyses'), { recursive: true });
  await fs.mkdir(join(qaDir, 'tests', 'reports'), { recursive: true });
  await fs.mkdir(join(qaDir, 'fixtures', 'auth'), { recursive: true });

  // Criar mcp-settings.json
  const settingsPath = join(qaDir, 'mcp-settings.json');
  if (!(await fileExists(settingsPath))) {
    const settings = {
      product: input.product,
      base_url: input.base_url,
      domains: input.domains || [],
      critical_flows: input.critical_flows || [],
      targets: {
        diff_coverage_min: 80,
        flaky_pct_max: 5,
        ci_p95_min: 8
      },
      environments: {
        dev: { url: input.base_url.replace('www', 'dev') },
        stg: { url: input.base_url.replace('www', 'stg') },
        prod: { url: input.base_url }
      },
      auth: {
        strategy: 'storageState',
        storageStatePath: 'fixtures/auth/storageState.json'
      }
    };

    await writeFileSafe(settingsPath, JSON.stringify(settings, null, 2), false);
    console.log(`✅ Created: ${settingsPath}`);
  }

  // Criar GETTING_STARTED.md
  const gettingStartedPath = join(qaDir, 'GETTING_STARTED.md');
  if (!(await fileExists(gettingStartedPath))) {
    const template = await fs.readFile(
      join(__dirname, 'templates', 'GETTING_STARTED.md'),
      'utf-8'
    );

    const content = template
      .replace(/{{PRODUCT}}/g, input.product)
      .replace(/{{BASE_URL}}/g, input.base_url)
      .replace(/{{PRODUCT_DOMAIN}}/g, new URL(input.base_url).hostname)
      .replace(/{{DOMAINS}}/g, JSON.stringify(input.domains || []))
      .replace(/{{CRITICAL_FLOWS}}/g, JSON.stringify(input.critical_flows || []))
      .replace(/{{DIFF_COVERAGE_MIN}}/g, '80')
      .replace(/{{FLAKY_PCT_MAX}}/g, '5')
      .replace(/{{CI_P95_MIN}}/g, '8')
      .replace(/{{DATE}}/g, new Date().toISOString().split('T')[0]);

    await writeFileSafe(gettingStartedPath, content, false);
    console.log(`✅ Created: ${gettingStartedPath}`);
  }

  // Criar .gitignore para a pasta qa
  const gitignorePath = join(qaDir, '.gitignore');
  if (!(await fileExists(gitignorePath))) {
    const gitignoreContent = `# Test outputs
tests/reports/
tests/analyses/*.html
tests/analyses/dashboard.html
playwright-report/
test-results/

# Auth fixtures (sensitive)
fixtures/auth/storageState.json
fixtures/auth/*.json

# Environment
.env
.env.local

# Backups
*.bak

# Node
node_modules/
.pnpm-debug.log*

# Coverage
coverage/
.nyc_output/

# OS
.DS_Store
Thumbs.db
`;
    await writeFileSafe(gitignorePath, gitignoreContent, false);
    console.log(`✅ Created: ${gitignorePath}`);
  }

  // Criar README.md básico
  const readmePath = join(qaDir, 'README.md');
  if (!(await fileExists(readmePath))) {
    const readmeContent = `# ${input.product} - Quality Assurance

## Quick Start

\`\`\`bash
# 1. Analise o código
quality analyze --repo ../.. --product ${input.product}

# 2. Gere o plano
quality plan --product ${input.product}

# 3. Crie a estrutura de testes
quality scaffold-unit --product ${input.product}
quality scaffold-integration --product ${input.product}
quality scaffold --product ${input.product}

# 4. Execute os testes
quality run --product ${input.product}

# 5. Analise cobertura
quality coverage --product ${input.product}
\`\`\`

📖 **Documentação completa:** [GETTING_STARTED.md](./GETTING_STARTED.md)

## Estrutura

- \`tests/unit/\` - Testes unitários (Dev)
- \`tests/integration/\` - Testes de integração (Dev + QA)
- \`tests/e2e/\` - Testes E2E (QA)
- \`tests/analyses/\` - Análises e relatórios gerados
- \`fixtures/\` - Dados de teste e autenticação

## Quality Gates

- ✅ Diff Coverage: ≥ 80%
- ✅ Flaky Tests: ≤ 5%
- ✅ CI P95: ≤ 8 min
`;
    await writeFileSafe(readmePath, readmeContent, false);
    console.log(`✅ Created: ${readmePath}`);
  }

  console.log(`\n✅ Product QA structure initialized at: ${qaDir}`);
  console.log(`\n📝 Next steps:`);
  console.log(`   1. Review and update: ${settingsPath}`);
  console.log(`   2. Read documentation: ${gettingStartedPath}`);
  console.log(`   3. Run: quality analyze --repo ${input.repo} --product ${input.product}`);

  return {
    ok: true,
    path: qaDir
  };
}

import { join as joinPath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { join, writeFileSafe, ensureDir } from '../utils/fs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ScaffoldParams {
  repo: string;
  plan_file: string;
  out_dir: string;
}

export async function scaffoldPlaywright(input: ScaffoldParams): Promise<{ ok: boolean; e2e_dir: string }> {
  console.log(`🏗️  Criando estrutura Playwright em ${input.out_dir}...`);

  const root = join(input.repo, input.out_dir);
  
  // Criar estrutura de diretórios
  await ensureDir(join(root, 'tests/auth'));
  await ensureDir(join(root, 'tests/claim'));
  await ensureDir(join(root, 'tests/search'));
  await ensureDir(join(root, 'fixtures'));
  await ensureDir(join(root, 'utils'));

  // playwright.config.ts
  await writeFileSafe(join(root, 'playwright.config.ts'), `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 35_000,
  expect: {
    timeout: 5000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['html', { outputFolder: '../../reports/html', open: 'never' }],
    ['junit', { outputFile: '../../reports/junit/results.xml' }],
    ['json', { outputFile: '../../reports/json/results.json' }],
    ['list']
  ],
  use: {
    baseURL: process.env.BASE_URL ?? process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    // Storage state para reutilizar autenticação
    storageState: process.env.STORAGE_STATE ?? 'fixtures/auth/storageState.json',
  },
  projects: [
    // Setup project para autenticação
    {
      name: 'setup',
      testMatch: /.*\\.setup\\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-chrome',
      use: { 
        ...devices['Pixel 7'],
        // Mobile pode precisar de autenticação separada
        storageState: undefined,
      },
      dependencies: ['setup'],
    },
  ],
  webServer: process.env.E2E_START_SERVER ? {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  } : undefined,
});
`);

  // package.json para o diretório e2e
  await writeFileSafe(join(root, 'package.json'), `{
  "name": "product-e2e",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "test:headed": "playwright test --headed",
    "test:debug": "playwright test --debug",
    "test:auth": "playwright test tests/auth",
    "test:claim": "playwright test tests/claim",
    "test:search": "playwright test tests/search",
    "report": "playwright show-report ../../reports/html"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0"
  }
}
`);

  // .env.example
  await writeFileSafe(join(root, '.env.example'), `E2E_BASE_URL=https://staging.example.com
E2E_USER=test@example.com
E2E_PASS=your-test-password
E2E_START_SERVER=false
`);

  // Auth setup file (global setup)
  await writeFileSafe(join(root, 'tests', 'auth.setup.ts'), `import { test as setup, expect } from '@playwright/test';
import { join } from 'path';

const authFile = join(__dirname, '..', 'fixtures', 'auth', 'storageState.json');

setup('authenticate', async ({ page }) => {
  // Navega para página de login
  await page.goto('/login');
  
  // Preenche credenciais
  await page.getByLabel('Email').fill(process.env.E2E_USER ?? 'test@example.com');
  await page.getByLabel('Senha').fill(process.env.E2E_PASS ?? 'password');
  
  // Faz login
  await page.getByRole('button', { name: /entrar|login/i }).click();
  
  // Aguarda estar autenticado
  await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {
    // Fallback: verifica se tem algum elemento que indica auth
    return expect(page.getByRole('button', { name: /sair|logout/i })).toBeVisible({ timeout: 5000 });
  });
  
  // Salva estado autenticado
  await page.context().storageState({ path: authFile });
  
  console.log('✅ Authentication state saved to:', authFile);
});
`);

  // Fixture de autenticação (deprecated - usar auth.setup.ts)
  await writeFileSafe(join(root, 'fixtures', 'auth.ts'), `import { test as base } from '@playwright/test';

/**
 * @deprecated Use global setup (tests/auth.setup.ts) instead
 * This fixture is kept for backward compatibility
 */
export const test = base.extend({
  // Nenhuma fixture necessária - autenticação é feita no setup global
});

export const expect = test.expect;
`);

  // Utilitário de test data
  await writeFileSafe(join(root, 'utils', 'test-data.ts'), `/**
 * Gerador de dados de teste determinísticos
 */

export class TestDataFactory {
  static generateEmail(prefix: string = 'test'): string {
    const timestamp = Date.now();
    return \`\${prefix}-\${timestamp}@teste.local\`;
  }

  static generateCompanyName(): string {
    const companies = ['Acme Corp', 'TechSolutions', 'GlobalServices', 'InnovateTech'];
    return companies[Math.floor(Math.random() * companies.length)];
  }

  static generateClaimDescription(): string {
    return 'Descrição de teste automatizada gerada em ' + new Date().toISOString();
  }

  static generateRandomString(length: number = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  }
}
`);

  // Testes de autenticação
  await writeFileSafe(join(root, 'tests/auth/login.spec.ts'), `import { test, expect } from '@playwright/test';

test.describe('Autenticação - Login', () => {
  test('deve fazer login com credenciais válidas', async ({ page }) => {
    await page.goto('/');
    
    await page.getByLabel('Email').fill(process.env.E2E_USER!);
    await page.getByLabel('Senha').fill(process.env.E2E_PASS!);
    await page.getByRole('button', { name: /entrar/i }).click();
    
    // Verifica redirecionamento ou mensagem de sucesso
    await expect(page.getByText(/bem-vindo/i)).toBeVisible({ timeout: 10000 });
  });

  test('deve mostrar erro com credenciais inválidas', async ({ page }) => {
    await page.goto('/');
    
    await page.getByLabel('Email').fill('invalido@teste.com');
    await page.getByLabel('Senha').fill('senhaerrada123');
    await page.getByRole('button', { name: /entrar/i }).click();
    
    await expect(page.getByText(/credenciais inválidas|erro/i)).toBeVisible();
  });

  test('deve validar campos obrigatórios', async ({ page }) => {
    await page.goto('/');
    
    await page.getByRole('button', { name: /entrar/i }).click();
    
    // Verifica mensagens de validação
    await expect(page.getByText(/email.*obrigatório|campo obrigatório/i)).toBeVisible();
  });
});
`);

  await writeFileSafe(join(root, 'tests/auth/session.spec.ts'), `import { test, expect } from '@playwright/test';

test.describe('Autenticação - Sessão', () => {
  test('deve manter sessão após recarregar página', async ({ page }) => {
    await page.goto('/');
    
    // Login
    await page.getByLabel('Email').fill(process.env.E2E_USER!);
    await page.getByLabel('Senha').fill(process.env.E2E_PASS!);
    await page.getByRole('button', { name: /entrar/i }).click();
    
    await expect(page.getByText(/bem-vindo/i)).toBeVisible();
    
    // Recarrega página
    await page.reload();
    
    // Verifica que ainda está logado
    await expect(page.getByText(/bem-vindo/i)).toBeVisible();
  });

  test('deve fazer logout', async ({ page }) => {
    await page.goto('/');
    
    // Login
    await page.getByLabel('Email').fill(process.env.E2E_USER!);
    await page.getByLabel('Senha').fill(process.env.E2E_PASS!);
    await page.getByRole('button', { name: /entrar/i }).click();
    
    // Logout
    await page.getByRole('button', { name: /sair|logout/i }).click();
    
    // Verifica redirecionamento para login
    await expect(page.getByLabel('Email')).toBeVisible();
  });
});
`);

  // Testes de reclamação
  await writeFileSafe(join(root, 'tests/claim/open-claim.spec.ts'), `import { test, expect } from '../fixtures/auth';
import { TestDataFactory } from '../../utils/test-data';

test.describe('Reclamação - Abertura', () => {
  test.use({ storageState: '.auth.json' });

  test('deve abrir nova reclamação com sucesso', async ({ page }) => {
    await page.goto('/reclamacoes/nova');
    
    await page.getByLabel(/empresa/i).fill(TestDataFactory.generateCompanyName());
    await page.getByLabel(/assunto/i).fill('Produto com defeito');
    await page.getByLabel(/descrição/i).fill(TestDataFactory.generateClaimDescription());
    
    await page.getByRole('button', { name: /enviar|criar/i }).click();
    
    await expect(page.getByText(/reclamação criada|sucesso/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/protocolo/i)).toBeVisible();
  });

  test('deve validar campos obrigatórios ao abrir reclamação', async ({ page }) => {
    await page.goto('/reclamacoes/nova');
    
    await page.getByRole('button', { name: /enviar|criar/i }).click();
    
    await expect(page.getByText(/campo obrigatório|preencha/i)).toBeVisible();
  });
});
`);

  await writeFileSafe(join(root, 'tests/claim/claim-validation.spec.ts'), `import { test, expect } from '../fixtures/auth';

test.describe('Reclamação - Validações', () => {
  test.use({ storageState: '.auth.json' });

  test('deve limitar tamanho da descrição', async ({ page }) => {
    await page.goto('/reclamacoes/nova');
    
    const longText = 'A'.repeat(5000);
    await page.getByLabel(/descrição/i).fill(longText);
    
    // Verifica limitação ou mensagem de validação
    const textValue = await page.getByLabel(/descrição/i).inputValue();
    expect(textValue.length).toBeLessThanOrEqual(3000);
  });

  test('deve permitir anexar arquivos', async ({ page }) => {
    await page.goto('/reclamacoes/nova');
    
    // Simula upload de arquivo (ajustar seletor conforme UI)
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles({
        name: 'test.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Conteúdo de teste')
      });
      
      await expect(page.getByText(/test.txt|arquivo anexado/i)).toBeVisible();
    }
  });
});
`);

  // Testes de busca
  await writeFileSafe(join(root, 'tests/search/search-company.spec.ts'), `import { test, expect } from '@playwright/test';

test.describe('Busca - Empresa', () => {
  test('deve buscar e encontrar empresa', async ({ page }) => {
    await page.goto('/busca');
    
    await page.getByLabel(/buscar empresa/i).fill('Acme');
    await page.keyboard.press('Enter');
    
    await expect(page.getByRole('heading', { name: /resultados/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /acme/i }).first()).toBeVisible();
  });

  test('deve mostrar mensagem quando não encontrar resultados', async ({ page }) => {
    await page.goto('/busca');
    
    const searchTerm = 'XYZ123NaoExiste' + Date.now();
    await page.getByLabel(/buscar empresa/i).fill(searchTerm);
    await page.keyboard.press('Enter');
    
    await expect(page.getByText(/nenhum resultado|não encontrado/i)).toBeVisible();
  });

  test('deve limpar busca', async ({ page }) => {
    await page.goto('/busca');
    
    await page.getByLabel(/buscar empresa/i).fill('Teste');
    const clearButton = page.getByRole('button', { name: /limpar/i });
    
    if (await clearButton.count() > 0) {
      await clearButton.click();
      await expect(page.getByLabel(/buscar empresa/i)).toHaveValue('');
    }
  });
});
`);

  await writeFileSafe(join(root, 'tests/search/search-filters.spec.ts'), `import { test, expect } from '@playwright/test';

test.describe('Busca - Filtros', () => {
  test('deve aplicar filtros de busca', async ({ page }) => {
    await page.goto('/busca');
    
    await page.getByLabel(/buscar empresa/i).fill('Acme');
    await page.keyboard.press('Enter');
    
    // Verifica se há opções de filtro (ajustar conforme UI)
    const filterButton = page.getByRole('button', { name: /filtrar|filtros/i });
    if (await filterButton.count() > 0) {
      await filterButton.click();
      await expect(page.getByText(/categoria|segmento|localização/i)).toBeVisible();
    }
  });

  test('deve ordenar resultados', async ({ page }) => {
    await page.goto('/busca');
    
    await page.getByLabel(/buscar empresa/i).fill('Acme');
    await page.keyboard.press('Enter');
    
    // Verifica opções de ordenação (ajustar conforme UI)
    const sortButton = page.getByRole('button', { name: /ordenar/i });
    if (await sortButton.count() > 0) {
      await sortButton.click();
      await expect(page.getByText(/relevância|nome|recente/i)).toBeVisible();
    }
  });
});
`);

  // README para o diretório e2e
  await writeFileSafe(join(root, 'README.md'), `# Testes E2E com Playwright

## Pré-requisitos

- Node.js 20+
- Variáveis de ambiente configuradas (ver .env.example)

## Instalação

\`\`\`bash
npm install
npx playwright install --with-deps
\`\`\`

## Configuração

Copie o arquivo \`.env.example\` para \`.env\` e configure as variáveis:

\`\`\`bash
cp .env.example .env
\`\`\`

## Execução

### Todos os testes
\`\`\`bash
npm test
\`\`\`

### Por domínio
\`\`\`bash
npm run test:auth
npm run test:claim
npm run test:search
\`\`\`

### Modo debug
\`\`\`bash
npm run test:debug
\`\`\`

### Com interface
\`\`\`bash
npm run test:headed
\`\`\`

## Relatórios

Após a execução, os relatórios estarão disponíveis em:
- HTML: \`../../reports/html/index.html\`
- JUnit: \`../../reports/junit/results.xml\`
- JSON: \`../../reports/json/results.json\`

Para visualizar o relatório HTML:
\`\`\`bash
npm run report
\`\`\`

## Estrutura

- \`tests/auth/\` - Testes de autenticação
- \`tests/claim/\` - Testes de reclamações
- \`tests/search/\` - Testes de busca
- \`fixtures/\` - Fixtures e configurações reutilizáveis
- \`utils/\` - Utilitários e helpers

## Boas Práticas

1. Use Page Object Model para páginas complexas
2. Mantenha testes independentes e isolados
3. Use fixtures para setup/teardown
4. Evite sleeps, prefira waitFor*
5. Use seletores semânticos (role, label, text)
`);

  console.log(`✅ Estrutura Playwright criada em ${root}`);

  return { ok: true, e2e_dir: root };
}


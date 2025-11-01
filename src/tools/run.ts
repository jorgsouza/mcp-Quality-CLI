import { spawn } from 'node:child_process';
import { join, ensureDir } from '../utils/fs.js';
import { loadMCPSettings, mergeSettings } from '../utils/config.js';

export interface RunParams {
  repo: string;
  product?: string;
  e2e_dir?: string;
  report_dir?: string;
  headless?: boolean;
}

export interface RunResult {
  ok: boolean;
  reports: {
    html: string;
    junit: string;
    json: string;
  };
  stats?: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
  };
  error?: string;
}

export async function runPlaywright(input: RunParams): Promise<RunResult> {
  // Carrega e mescla configurações
  const fileSettings = await loadMCPSettings(input.repo, input.product);
  const settings = mergeSettings(fileSettings, input);

  const e2eDir = settings.e2e_dir || 'tests/e2e';
  const reportDir = settings.report_dir || 'tests/reports';

  console.log(`🧪 Executando testes Playwright em ${e2eDir}...`);

  const reportRoot = join(input.repo, reportDir);
  
  // Criar diretórios de relatório
  await ensureDir(join(reportRoot, 'html'));
  await ensureDir(join(reportRoot, 'json'));
  await ensureDir(join(reportRoot, 'junit'));
  await ensureDir(join(reportRoot, 'coverage'));

  const env = {
    ...process.env,
    E2E_BASE_URL: process.env.E2E_BASE_URL ?? settings.base_url ?? 'http://localhost:3000',
    E2E_USER: process.env.E2E_USER ?? 'test@example.com',
    E2E_PASS: process.env.E2E_PASS ?? 'test123',
    HEADLESS: settings.headless !== false ? '1' : '0',
    FORCE_COLOR: '1'
  };

  try {
    // Instala browsers se necessário
    console.log('📦 Instalando browsers Playwright...');
    await runCommand('npx', ['playwright', 'install', '--with-deps', 'chromium'], {
      cwd: join(input.repo, e2eDir),
      env
    });

    // Executa testes
    console.log('▶️  Executando testes...');
    await runCommand('npx', ['playwright', 'test', '--reporter=list,html,junit,json'], {
      cwd: join(input.repo, e2eDir),
      env
    });

    console.log('✅ Testes executados com sucesso!');

    return {
      ok: true,
      reports: {
        html: `${reportDir}/html/index.html`,
        junit: `${reportDir}/junit/results.xml`,
        json: `${reportDir}/json/results.json`
      }
    };
  } catch (error: any) {
    console.error('❌ Erro ao executar testes:', error.message);
    
    return {
      ok: false,
      reports: {
        html: `${reportDir}/html/index.html`,
        junit: `${reportDir}/junit/results.xml`,
        json: `${reportDir}/json/results.json`
      },
      error: error.message
    };
  }
}

function runCommand(
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      ...options,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}


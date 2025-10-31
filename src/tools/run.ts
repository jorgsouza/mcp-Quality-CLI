import { spawn } from 'node:child_process';
import { join, ensureDir } from '../utils/fs.js';

export interface RunParams {
  repo: string;
  e2e_dir: string;
  report_dir: string;
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
  console.log(`🧪 Executando testes Playwright em ${input.e2e_dir}...`);

  const reportRoot = join(input.repo, input.report_dir);
  
  // Criar diretórios de relatório
  await ensureDir(join(reportRoot, 'html'));
  await ensureDir(join(reportRoot, 'json'));
  await ensureDir(join(reportRoot, 'junit'));
  await ensureDir(join(reportRoot, 'coverage'));

  const env = {
    ...process.env,
    E2E_BASE_URL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    E2E_USER: process.env.E2E_USER ?? 'test@example.com',
    E2E_PASS: process.env.E2E_PASS ?? 'test123',
    HEADLESS: input.headless !== false ? '1' : '0',
    FORCE_COLOR: '1'
  };

  try {
    // Instala browsers se necessário
    console.log('📦 Instalando browsers Playwright...');
    await runCommand('npx', ['playwright', 'install', '--with-deps', 'chromium'], {
      cwd: input.e2e_dir,
      env
    });

    // Executa testes
    console.log('▶️  Executando testes...');
    await runCommand('npx', ['playwright', 'test', '--reporter=list,html,junit,json'], {
      cwd: input.e2e_dir,
      env
    });

    console.log('✅ Testes executados com sucesso!');

    return {
      ok: true,
      reports: {
        html: `${input.report_dir}/html/index.html`,
        junit: `${input.report_dir}/junit/results.xml`,
        json: `${input.report_dir}/json/results.json`
      }
    };
  } catch (error: any) {
    console.error('❌ Erro ao executar testes:', error.message);
    
    return {
      ok: false,
      reports: {
        html: `${input.report_dir}/html/index.html`,
        junit: `${input.report_dir}/junit/results.xml`,
        json: `${input.report_dir}/json/results.json`
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


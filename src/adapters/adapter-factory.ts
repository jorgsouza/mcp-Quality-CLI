/**
 * Adapter Factory
 * 
 * Factory para criar adapters de linguagem de forma polimórfica.
 * Detecta automaticamente a linguagem e retorna o adapter correspondente.
 * 
 * FASE A.5 - Engine Refactoring
 * 
 * @see ROADMAP-V1-COMPLETO.md (Fase A.5)
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LanguageAdapter, LanguageDetection } from './base/LanguageAdapter.js';
import { TypeScriptAdapter } from './typescript.js';
import { PythonAdapter } from './python.js';
import { GoAdapter } from './go.js';
import { JavaAdapter } from './java.js';

/**
 * Registro de adapters disponíveis
 */
const ADAPTER_REGISTRY: LanguageAdapter[] = [
  new TypeScriptAdapter(),
  new PythonAdapter(),
  new GoAdapter(),
  new JavaAdapter(),
];

/**
 * Detecta a linguagem principal do repositório
 * 
 * @param repo - Caminho do repositório
 * @returns Linguagem detectada com nível de confiança
 * 
 * @example
 * ```typescript
 * const detection = await detectLanguage('/my-project');
 * console.log(detection.language); // 'typescript'
 * console.log(detection.confidence); // 0.95
 * ```
 */
export async function detectLanguage(repo: string): Promise<LanguageDetection | null> {
  // Estratégia 1: Verificar package.json (Node.js/TypeScript)
  if (existsSync(join(repo, 'package.json'))) {
    try {
      const packageJson = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf-8'));
      const hasTypeScript = 
        existsSync(join(repo, 'tsconfig.json')) ||
        packageJson.devDependencies?.typescript ||
        packageJson.dependencies?.typescript;

      return {
        language: hasTypeScript ? 'typescript' : 'javascript',
        confidence: 0.95,
        framework: hasTypeScript ? 'typescript' : 'javascript',
        packageManager: detectPackageManager(repo),
      };
    } catch (error) {
      // Ignorar erro de parse
    }
  }

  // Estratégia 2: Verificar go.mod (Go)
  if (existsSync(join(repo, 'go.mod'))) {
    return {
      language: 'go',
      confidence: 0.98,
      framework: 'go',
      packageManager: 'go mod',
    };
  }

  // Estratégia 3: Verificar setup.py ou requirements.txt (Python)
  if (
    existsSync(join(repo, 'setup.py')) ||
    existsSync(join(repo, 'requirements.txt')) ||
    existsSync(join(repo, 'pyproject.toml')) ||
    existsSync(join(repo, 'Pipfile'))
  ) {
    return {
      language: 'python',
      confidence: 0.95,
      framework: 'python',
      packageManager: 'pip',
    };
  }

  // Estratégia 4: Verificar pom.xml ou build.gradle (Java)
  if (existsSync(join(repo, 'pom.xml')) || existsSync(join(repo, 'build.gradle'))) {
    return {
      language: 'java',
      confidence: 0.95,
      framework: 'java',
      packageManager: existsSync(join(repo, 'pom.xml')) ? 'maven' : 'gradle',
    };
  }

  // Estratégia 5: Verificar Gemfile (Ruby)
  if (existsSync(join(repo, 'Gemfile'))) {
    return {
      language: 'ruby',
      confidence: 0.95,
      framework: 'ruby',
      packageManager: 'bundler' as any,
    };
  }

  return null;
}

/**
 * Detecta o gerenciador de pacotes Node.js
 */
function detectPackageManager(repo: string): 'npm' | 'yarn' | 'pnpm' {
  if (existsSync(join(repo, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(repo, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

/**
 * Cria um adapter baseado na linguagem
 * 
 * @param language - Nome da linguagem ('typescript', 'python', 'go', etc)
 * @returns Adapter correspondente ou null se não suportado
 * 
 * @example
 * ```typescript
 * const adapter = createAdapter('typescript');
 * if (adapter) {
 *   const framework = await adapter.detectFramework('/my-project');
 * }
 * ```
 */
export function createAdapter(language: string): LanguageAdapter | null {
  const normalizedLang = language.toLowerCase();

  // Suporte para aliases
  const languageMap: Record<string, string> = {
    'typescript': 'typescript',
    'ts': 'typescript',
    'javascript': 'typescript', // Mesmo adapter
    'js': 'typescript',
    'python': 'python',
    'py': 'python',
    'go': 'go',
    'golang': 'go',
    'java': 'java',
    'ruby': 'ruby',
    'rb': 'ruby',
  };

  const mappedLanguage = languageMap[normalizedLang];

  if (!mappedLanguage) {
    console.warn(`Linguagem não suportada: ${language}`);
    return null;
  }

  const adapter = ADAPTER_REGISTRY.find((a) => a.language === mappedLanguage);

  return adapter || null;
}

/**
 * Detecta automaticamente a linguagem e retorna o adapter apropriado
 * 
 * @param repo - Caminho do repositório
 * @returns Adapter apropriado ou null se linguagem não suportada
 * 
 * @example
 * ```typescript
 * const adapter = await getAdapter('/my-project');
 * if (adapter) {
 *   console.log(`Adapter: ${adapter.language}`);
 *   const tests = await adapter.discoverTests('/my-project');
 * }
 * ```
 */
export async function getAdapter(repo: string): Promise<LanguageAdapter | null> {
  const detection = await detectLanguage(repo);

  if (!detection) {
    console.warn('Nenhuma linguagem detectada no repositório');
    return null;
  }

  console.log(`🔍 Linguagem detectada: ${detection.language} (confiança: ${Math.round(detection.confidence * 100)}%)`);

  return createAdapter(detection.language);
}

/**
 * Retorna todos os adapters registrados
 * 
 * @returns Lista de todos os adapters disponíveis
 * 
 * @example
 * ```typescript
 * const adapters = getAllAdapters();
 * console.log(adapters.map(a => a.language)); // ['typescript', 'python', 'go']
 * ```
 */
export function getAllAdapters(): LanguageAdapter[] {
  return [...ADAPTER_REGISTRY];
}

/**
 * Registra um novo adapter (para extensibilidade futura)
 * 
 * @param adapter - Adapter a ser registrado
 * 
 * @example
 * ```typescript
 * const rustAdapter = new RustAdapter();
 * registerAdapter(rustAdapter);
 * ```
 */
export function registerAdapter(adapter: LanguageAdapter): void {
  // Verificar se já existe
  const existingIndex = ADAPTER_REGISTRY.findIndex((a) => a.language === adapter.language);

  if (existingIndex >= 0) {
    console.warn(`Adapter para ${adapter.language} já existe. Substituindo...`);
    ADAPTER_REGISTRY[existingIndex] = adapter;
  } else {
    ADAPTER_REGISTRY.push(adapter);
    console.log(`✅ Adapter registrado: ${adapter.language}`);
  }
}

/**
 * Valida se o repositório é suportado por algum adapter
 * 
 * @param repo - Caminho do repositório
 * @returns True se suportado, false caso contrário
 * 
 * @example
 * ```typescript
 * if (await isRepositorySupported('/my-project')) {
 *   console.log('Repositório suportado!');
 * }
 * ```
 */
export async function isRepositorySupported(repo: string): Promise<boolean> {
  const detection = await detectLanguage(repo);
  return detection !== null;
}

/**
 * Retorna informações sobre linguagens suportadas
 * 
 * @returns Array com informações de cada adapter
 * 
 * @example
 * ```typescript
 * const supported = getSupportedLanguages();
 * supported.forEach(lang => {
 *   console.log(`${lang.name}: ${lang.extensions.join(', ')}`);
 * });
 * ```
 */
export function getSupportedLanguages(): Array<{
  name: string;
  extensions: string[];
  frameworks?: string[];
}> {
  return ADAPTER_REGISTRY.map((adapter) => {
    // Detectar frameworks do adapter (se tiver detectFramework)
    const frameworks: string[] = [];

    return {
      name: adapter.language,
      extensions: adapter.fileExtensions,
      frameworks,
    };
  });
}


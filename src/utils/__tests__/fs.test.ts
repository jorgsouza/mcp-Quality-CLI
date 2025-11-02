import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ensureDir, writeFileSafe, readFile } from '../fs.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('ensureDir', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `fs-test-${Date.now()}`);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignorar erros de limpeza
    }
  });

  // 1. Criar diretório novo
  it('deve criar diretório recursivamente', async () => {
    const nestedDir = join(testDir, 'a/b/c');
    
    await ensureDir(nestedDir);
    
    const stats = await fs.stat(nestedDir);
    expect(stats.isDirectory()).toBe(true);
  });

  // 2. Diretório já existe
  it('não deve falhar se diretório já existir', async () => {
    await fs.mkdir(testDir, { recursive: true });
    
    // Não deve lançar erro
    await expect(ensureDir(testDir)).resolves.not.toThrow();
    
    const stats = await fs.stat(testDir);
    expect(stats.isDirectory()).toBe(true);
  });
});

describe('writeFileSafe', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `fs-test-${Date.now()}`);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignorar erros de limpeza
    }
  });

  // 3. Escrever arquivo novo
  it('deve criar diretório pai e escrever arquivo', async () => {
    const filePath = join(testDir, 'nested/dir/file.txt');
    const content = 'Hello World';
    
    await writeFileSafe(filePath, content);
    
    const readContent = await fs.readFile(filePath, 'utf8');
    expect(readContent).toBe(content);
  });

  // 4. Sobrescrever arquivo
  it('deve sobrescrever arquivo existente', async () => {
    const filePath = join(testDir, 'file.txt');
    
    // Criar diretório e arquivo inicial
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(filePath, 'Old content');
    
    // Sobrescrever
    await writeFileSafe(filePath, 'New content');
    
    const readContent = await fs.readFile(filePath, 'utf8');
    expect(readContent).toBe('New content');
  });
});

describe('readFile', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `fs-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignorar erros de limpeza
    }
  });

  // 5. Arquivo não existe
  it('deve lançar erro se arquivo não existir', async () => {
    const nonExistentFile = join(testDir, 'does-not-exist.txt');
    
    await expect(readFile(nonExistentFile)).rejects.toThrow();
  });

  // Teste adicional: ler arquivo existente
  it('deve ler conteúdo de arquivo existente', async () => {
    const filePath = join(testDir, 'test.txt');
    const content = 'Test content';
    
    await fs.writeFile(filePath, content);
    
    const readContent = await readFile(filePath);
    expect(readContent).toBe(content);
  });
});

describe('Side Effects: ensureDir', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `fs-spy-test-${Date.now()}`);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignorar erros de limpeza
    }
  });

  it('deve chamar fs.mkdir com opção recursive:true', async () => {
    const mkdirSpy = vi.spyOn(fs, 'mkdir');
    const nestedDir = join(testDir, 'a/b/c');
    
    await ensureDir(nestedDir);
    
    expect(mkdirSpy).toHaveBeenCalledWith(nestedDir, { recursive: true });
    expect(mkdirSpy).toHaveBeenCalledTimes(1);
  });

  it('não deve falhar quando diretório já existe (EEXIST)', async () => {
    // Cria diretório primeiro
    await fs.mkdir(testDir, { recursive: true });
    
    const mkdirSpy = vi.spyOn(fs, 'mkdir');
    
    // Não deve lançar erro
    await expect(ensureDir(testDir)).resolves.not.toThrow();
    
    expect(mkdirSpy).toHaveBeenCalledWith(testDir, { recursive: true });
  });
});

describe('Side Effects: writeFileSafe', () => {
  let testDir: string;
  let consoleLogSpy: any;

  beforeEach(() => {
    testDir = join(tmpdir(), `fs-spy-test-${Date.now()}`);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignorar erros de limpeza
    }
  });

  it('deve chamar ensureDir antes de escrever arquivo', async () => {
    const filePath = join(testDir, 'nested/dir/file.txt');
    const content = 'Test content';
    
    const mkdirSpy = vi.spyOn(fs, 'mkdir');
    const writeFileSpy = vi.spyOn(fs, 'writeFile');
    
    await writeFileSafe(filePath, content);
    
    // Verifica que mkdir foi chamado com o diretório pai
    expect(mkdirSpy).toHaveBeenCalled();
    expect(mkdirSpy.mock.calls[0][1]).toEqual({ recursive: true });
    
    // Verifica que writeFile foi chamado com os parâmetros corretos
    expect(writeFileSpy).toHaveBeenCalledWith(filePath, content, 'utf8');
    
    // Verifica ordem: mkdir deve vir antes de writeFile
    expect(mkdirSpy.mock.invocationCallOrder[0]).toBeLessThan(
      writeFileSpy.mock.invocationCallOrder[0]
    );
  });

  it('deve criar backup quando arquivo existe e createBackup=true', async () => {
    const filePath = join(testDir, 'file.txt');
    const oldContent = 'Old content';
    const newContent = 'New content';
    
    // Criar diretório e arquivo inicial
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(filePath, oldContent);
    
    const copyFileSpy = vi.spyOn(fs, 'copyFile');
    
    await writeFileSafe(filePath, newContent, true);
    
    // Verifica que backup foi criado
    expect(copyFileSpy).toHaveBeenCalledWith(
      filePath,
      `${filePath}.bak`
    );
    
    // Verifica que backup contém conteúdo antigo
    const backupContent = await fs.readFile(`${filePath}.bak`, 'utf-8');
    expect(backupContent).toBe(oldContent);
  });

  it('deve logar mensagem de backup criado', async () => {
    const filePath = join(testDir, 'file.txt');
    
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(filePath, 'Old');
    
    await writeFileSafe(filePath, 'New', true);
    
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('📦 Backup created:')
    );
  });

  it('não deve criar backup quando createBackup=false', async () => {
    const filePath = join(testDir, 'file.txt');
    
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(filePath, 'Old');
    
    const copyFileSpy = vi.spyOn(fs, 'copyFile');
    
    await writeFileSafe(filePath, 'New', false);
    
    expect(copyFileSpy).not.toHaveBeenCalled();
  });
});

describe('Side Effects: readFile', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `fs-spy-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignorar erros de limpeza
    }
  });

  it('deve chamar fs.readFile com encoding utf8', async () => {
    const filePath = join(testDir, 'test.txt');
    const content = 'Test content';
    
    await fs.writeFile(filePath, content);
    
    const readFileSpy = vi.spyOn(fs, 'readFile');
    
    await readFile(filePath);
    
    expect(readFileSpy).toHaveBeenCalledWith(filePath, 'utf8');
    expect(readFileSpy).toHaveBeenCalledTimes(1);
  });

  it('deve propagar erro quando arquivo não existe', async () => {
    const nonExistentFile = join(testDir, 'does-not-exist.txt');
    
    const readFileSpy = vi.spyOn(fs, 'readFile');
    
    await expect(readFile(nonExistentFile)).rejects.toThrow();
    
    expect(readFileSpy).toHaveBeenCalledWith(nonExistentFile, 'utf8');
  });
});


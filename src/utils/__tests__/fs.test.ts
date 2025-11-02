import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ensureDir, writeFileSafe, readFile, fileExists, readDir } from '../fs.js';
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

// =========================================
// Edge Cases: Validação de entrada
// =========================================
describe('Edge Cases: ensureDir', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'fs-edge-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('deve criar diretório com caracteres especiais no nome', async () => {
    const specialDir = join(testDir, 'test-dir with spaces & special!@#');
    await ensureDir(specialDir);
    
    const exists = await fs.access(specialDir).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('deve criar caminho profundamente aninhado', async () => {
    const deepPath = join(testDir, 'a', 'b', 'c', 'd', 'e', 'f', 'g');
    await ensureDir(deepPath);
    
    const exists = await fs.access(deepPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('deve lidar com diretório que já existe (idempotência)', async () => {
    const existingDir = join(testDir, 'existing');
    await fs.mkdir(existingDir);
    
    // Não deve lançar erro ao criar novamente
    await expect(ensureDir(existingDir)).resolves.not.toThrow();
  });
});

describe('Edge Cases: writeFileSafe', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'fs-edge-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('deve escrever arquivo com nome contendo caracteres especiais', async () => {
    const specialFile = join(testDir, 'file with spaces & chars!.txt');
    const content = 'test content';
    
    await writeFileSafe(specialFile, content);
    
    const written = await fs.readFile(specialFile, 'utf8');
    expect(written).toBe(content);
  });

  it('deve escrever string vazia sem erro', async () => {
    const file = join(testDir, 'empty.txt');
    await writeFileSafe(file, '');
    
    const content = await fs.readFile(file, 'utf8');
    expect(content).toBe('');
  });

  it('deve escrever conteúdo muito grande (>1MB)', async () => {
    const file = join(testDir, 'large.txt');
    const largeContent = 'x'.repeat(2 * 1024 * 1024); // 2MB
    
    await writeFileSafe(file, largeContent);
    
    const written = await fs.readFile(file, 'utf8');
    expect(written.length).toBe(largeContent.length);
  });

  it('deve lidar com múltiplas escritas sequenciais (race condition test)', async () => {
    const file = join(testDir, 'concurrent.txt');
    
    // Escreve 5 vezes em sequência
    for (let i = 0; i < 5; i++) {
      await writeFileSafe(file, `content-${i}`, false);
    }
    
    const final = await fs.readFile(file, 'utf8');
    expect(final).toBe('content-4');
  });

  it('deve falhar silenciosamente se backup falhar por falta de permissão', async () => {
    const file = join(testDir, 'protected.txt');
    await writeFileSafe(file, 'initial', false);
    
    // Mock copyFile para simular falha de permissão
    const copyFileSpy = vi.spyOn(fs, 'copyFile').mockRejectedValueOnce(new Error('EACCES: permission denied'));
    const consoleWarnSpy = vi.spyOn(console, 'warn');
    
    // Deve continuar e escrever o arquivo mesmo se backup falhar
    await expect(writeFileSafe(file, 'updated', true)).resolves.not.toThrow();
    
    expect(copyFileSpy).toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to create backup'));
    
    copyFileSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });
});

describe('Edge Cases: readFile', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'fs-edge-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('deve ler arquivo com diferentes encodings', async () => {
    const file = join(testDir, 'encoded.txt');
    const content = 'Conteúdo com acentuação: àéîõü';
    
    await fs.writeFile(file, content, 'utf8');
    
    const utf8Content = await readFile(file, 'utf8');
    expect(utf8Content).toBe(content);
    
    // Verifica que aceita outros encodings
    const latin1Content = await readFile(file, 'latin1');
    expect(typeof latin1Content).toBe('string');
  });

  it('deve lançar erro para arquivo não existente', async () => {
    const nonExistent = join(testDir, 'does-not-exist.txt');
    await expect(readFile(nonExistent)).rejects.toThrow();
  });

  it('deve ler arquivo vazio', async () => {
    const file = join(testDir, 'empty.txt');
    await fs.writeFile(file, '');
    
    const content = await readFile(file);
    expect(content).toBe('');
  });
});

describe('Edge Cases: fileExists', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'fs-edge-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('deve retornar false para arquivo inexistente', async () => {
    const nonExistent = join(testDir, 'nope.txt');
    const exists = await fileExists(nonExistent);
    expect(exists).toBe(false);
  });

  it('deve retornar true para arquivo existente', async () => {
    const file = join(testDir, 'exists.txt');
    await fs.writeFile(file, 'test');
    
    const exists = await fileExists(file);
    expect(exists).toBe(true);
  });

  it('deve retornar true para diretório existente', async () => {
    const dir = join(testDir, 'dir');
    await fs.mkdir(dir);
    
    const exists = await fileExists(dir);
    expect(exists).toBe(true);
  });

  it('deve retornar false para caminho vazio', async () => {
    const exists = await fileExists('');
    expect(exists).toBe(false);
  });
});

describe('Edge Cases: readDir', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'fs-edge-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('deve retornar array vazio para diretório inexistente', async () => {
    const nonExistent = join(testDir, 'nope');
    const files = await readDir(nonExistent);
    expect(files).toEqual([]);
  });

  it('deve retornar array vazio para diretório vazio', async () => {
    const emptyDir = join(testDir, 'empty');
    await fs.mkdir(emptyDir);
    
    const files = await readDir(emptyDir);
    expect(files).toEqual([]);
  });

  it('deve listar todos os arquivos em diretório populado', async () => {
    await fs.writeFile(join(testDir, 'file1.txt'), '');
    await fs.writeFile(join(testDir, 'file2.txt'), '');
    await fs.mkdir(join(testDir, 'subdir'));
    
    const files = await readDir(testDir);
    expect(files).toHaveLength(3);
    expect(files).toContain('file1.txt');
    expect(files).toContain('file2.txt');
    expect(files).toContain('subdir');
  });

  it('deve lidar com caracteres especiais em nomes de arquivos', async () => {
    const specialName = 'file with spaces & special!@#.txt';
    await fs.writeFile(join(testDir, specialName), '');
    
    const files = await readDir(testDir);
    expect(files).toContain(specialName);
  });
});


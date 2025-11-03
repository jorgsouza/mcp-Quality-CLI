import type { LanguageAdapter, TestGenerationOptions, TestScenario } from './base-adapter.js';

export class PythonAdapter implements LanguageAdapter {
  language = 'python';
  defaultFramework = 'pytest';
  
  generateUnitTest(functionName: string, filePath: string, options?: TestGenerationOptions): string {
    const scenarios = options?.scenarios || ['happy', 'error', 'edge'];
    const includeComments = options?.includeComments !== false;
    
    // Converter caminho para import Python (ex: src/utils/auth.py → src.utils.auth)
    const importPath = filePath
      .replace(/\.py$/, '')
      .replace(/\//g, '.')
      .replace(/^\./, '');
    
    // Converter snake_case para PascalCase para nome da classe
    const className = this.snakeToPascal(functionName);
    
    const testCases = this.generateScenarios(functionName, scenarios, includeComments);
    
    return `import pytest
from ${importPath} import ${functionName}


class Test${className}:
    """Testes para função ${functionName}"""
    
${testCases.map(tc => tc.code).join('\n\n')}
`;
  }
  
  generateIntegrationTest(componentName: string, options?: TestGenerationOptions): string {
    return `import pytest
from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


class Test${this.capitalize(componentName)}Integration:
    """Testes de integração para ${componentName}"""
    
    @pytest.fixture(autouse=True)
    def setup_teardown(self):
        """Setup e teardown para cada teste"""
        # Setup: Inicializar banco de dados de teste, mocks, etc.
        yield
        # Teardown: Limpar dados de teste
    
    def test_successful_request(self):
        """Testa requisição bem-sucedida"""
        response = client.get("/api/${componentName.toLowerCase()}")
        
        assert response.status_code == 200
        assert response.json() is not None
    
    def test_invalid_input(self):
        """Testa entrada inválida"""
        response = client.post(
            "/api/${componentName.toLowerCase()}",
            json={"invalid": "data"}
        )
        
        assert response.status_code == 400
        assert "error" in response.json()
    
    def test_database_error(self):
        """Testa erro de banco de dados"""
        # Mock database failure
        # Assert error handling
        pass
`;
  }
  
  generateE2ETest(scenarioName: string, options?: TestGenerationOptions): string {
    return `import pytest
from playwright.sync_api import Page, expect


class Test${this.capitalize(scenarioName)}E2E:
    """Testes E2E para ${scenarioName}"""
    
    @pytest.fixture(autouse=True)
    def setup(self, page: Page):
        """Setup para cada teste"""
        page.goto("/")
    
    def test_complete_flow(self, page: Page):
        """Testa fluxo completo de ${scenarioName}"""
        # 1. Arrange: Preparar estado inicial
        
        # 2. Act: Executar ações do usuário
        
        # 3. Assert: Verificar resultado esperado
        expect(page).to_have_url(re.compile(r"success"))
    
    def test_error_handling(self, page: Page):
        """Testa tratamento de erros"""
        # Simular erro
        
        # Verificar mensagem de erro
        expect(page.locator('[role="alert"]')).to_be_visible()
`;
  }
  
  getTestFileExtension(): string {
    return '_test.py';
  }
  
  getTestPatterns(): string[] {
    return [
      '**/test_*.py',
      '**/*_test.py',
      '**/tests/**/*.py'
    ];
  }
  
  getTestCommand(): string {
    return 'pytest';
  }
  
  getCoverageCommand(): string {
    return 'pytest --cov=. --cov-report=json';
  }
  
  getCoverageFile(): string {
    return 'coverage.json';
  }
  
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  
  private snakeToPascal(str: string): string {
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }
  
  private generateScenarios(functionName: string, scenarios: string[], includeComments: boolean): TestScenario[] {
    const result: TestScenario[] = [];
    
    if (scenarios.includes('happy')) {
      result.push({
        name: 'happy path',
        description: 'Testa cenário de sucesso com entradas válidas',
        code: `    def test_${functionName}_with_valid_input(self):
        """Testa ${functionName} com entrada válida"""
        ${includeComments ? '# Arrange: Preparar dados de entrada válidos\n        ' : ''}input_data = {}  # TODO: Definir input válido
        
        ${includeComments ? '# Act: Executar função\n        ' : ''}result = ${functionName}(input_data)
        
        ${includeComments ? '# Assert: Verificar resultado esperado\n        ' : ''}assert result is not None
        # TODO: Adicionar assertions específicas`
      });
    }
    
    if (scenarios.includes('error')) {
      result.push({
        name: 'error handling',
        description: 'Testa tratamento de erros',
        code: `    def test_${functionName}_handles_errors(self):
        """Testa tratamento de erros em ${functionName}"""
        ${includeComments ? '# Arrange: Preparar entrada inválida\n        ' : ''}invalid_input = None
        
        ${includeComments ? '# Act & Assert: Verificar que erro é lançado\n        ' : ''}with pytest.raises(Exception):  # TODO: Especificar tipo de exceção
            ${functionName}(invalid_input)`
      });
    }
    
    if (scenarios.includes('edge')) {
      result.push({
        name: 'edge cases',
        description: 'Testa casos extremos',
        code: `    @pytest.mark.parametrize("edge_case", [[], "", 0, -1, float('inf')])
    def test_${functionName}_edge_cases(self, edge_case):
        """Testa ${functionName} com casos extremos"""
        ${includeComments ? '# Act: Executar com caso extremo\n        ' : ''}result = ${functionName}(edge_case)
        
        ${includeComments ? '# Assert: Verificar comportamento esperado\n        ' : ''}assert result is not None
        # TODO: Validar comportamento esperado`
      });
    }
    
    return result;
  }
}

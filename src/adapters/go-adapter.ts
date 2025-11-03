import type { LanguageAdapter, TestGenerationOptions, TestScenario } from './base-adapter.js';

export class GoAdapter implements LanguageAdapter {
  language = 'go';
  defaultFramework = 'go-test';
  
  generateUnitTest(functionName: string, filePath: string, options?: TestGenerationOptions): string {
    const scenarios = options?.scenarios || ['happy', 'error', 'edge'];
    const includeComments = options?.includeComments !== false;
    
    // Extrai package do arquivo (ex: utils/math.go → utils)
    const packageName = filePath.split('/')[0] || 'main';
    
    const testCases = this.generateScenarios(functionName, scenarios, includeComments);
    
    return `package ${packageName}_test

import (
	"testing"
	"${packageName}"
)

${testCases.map(tc => tc.code).join('\n\n')}
`;
  }
  
  generateIntegrationTest(componentName: string, options?: TestGenerationOptions): string {
    return `package integration_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func Test${this.capitalize(componentName)}Integration(t *testing.T) {
	// Setup: Inicializar servidor de teste
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Mock handler
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(\`{"message": "success"}\`))
	}))
	defer server.Close()
	
	t.Run("successful request", func(t *testing.T) {
		resp, err := http.Get(server.URL + "/api/${componentName.toLowerCase()}")
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()
		
		if resp.StatusCode != http.StatusOK {
			t.Errorf("Expected status 200, got %d", resp.StatusCode)
		}
	})
	
	t.Run("invalid input", func(t *testing.T) {
		// Test error handling
		t.Skip("TODO: Implement invalid input test")
	})
	
	t.Run("database error", func(t *testing.T) {
		// Test database error handling
		t.Skip("TODO: Implement database error test")
	})
}
`;
  }
  
  generateE2ETest(scenarioName: string, options?: TestGenerationOptions): string {
    return `package e2e_test

import (
	"net/http"
	"testing"
	"time"
)

func Test${this.capitalize(scenarioName)}E2E(t *testing.T) {
	// Setup: Start application server
	// baseURL := "http://localhost:8080"
	
	t.Run("complete ${scenarioName} flow", func(t *testing.T) {
		// 1. Arrange: Setup initial state
		
		// 2. Act: Execute user actions
		
		// 3. Assert: Verify expected result
		t.Skip("TODO: Implement E2E test")
	})
	
	t.Run("error handling", func(t *testing.T) {
		// Test error scenario
		t.Skip("TODO: Implement error test")
	})
}
`;
  }
  
  getTestFileExtension(): string {
    return '_test.go';
  }
  
  getTestPatterns(): string[] {
    return ['**/*_test.go'];
  }
  
  getTestCommand(): string {
    return 'go test ./...';
  }
  
  getCoverageCommand(): string {
    return 'go test -coverprofile=coverage.out ./... && go tool cover -func=coverage.out';
  }
  
  getCoverageFile(): string {
    return 'coverage.out';
  }
  
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  
  private generateScenarios(functionName: string, scenarios: string[], includeComments: boolean): TestScenario[] {
    const result: TestScenario[] = [];
    const testName = this.capitalize(functionName);
    
    if (scenarios.includes('happy')) {
      result.push({
        name: 'happy path',
        description: 'Tests successful execution with valid input',
        code: `func Test${testName}WithValidInput(t *testing.T) {
	${includeComments ? '// Arrange: Prepare valid input\n	' : ''}input := struct{}{} // TODO: Define valid input
	
	${includeComments ? '// Act: Execute function\n	' : ''}result := ${functionName}(input)
	
	${includeComments ? '// Assert: Verify expected result\n	' : ''}if result == nil {
		t.Error("Expected non-nil result")
	}
	// TODO: Add specific assertions
}`
      });
    }
    
    if (scenarios.includes('error')) {
      result.push({
        name: 'error handling',
        description: 'Tests error handling',
        code: `func Test${testName}HandlesErrors(t *testing.T) {
	${includeComments ? '// Arrange: Prepare invalid input\n	' : ''}invalidInput := nil
	
	${includeComments ? '// Act: Execute function\n	' : ''}_, err := ${functionName}(invalidInput)
	
	${includeComments ? '// Assert: Verify error is returned\n	' : ''}if err == nil {
		t.Error("Expected error, got nil")
	}
	// TODO: Verify error type/message
}`
      });
    }
    
    if (scenarios.includes('edge')) {
      result.push({
        name: 'edge cases',
        description: 'Tests edge cases',
        code: `func Test${testName}EdgeCases(t *testing.T) {
	${includeComments ? '// Arrange: Prepare edge cases\n	' : ''}testCases := []struct {
		name  string
		input interface{}
		want  interface{}
	}{
		{"empty", "", nil},
		{"zero", 0, nil},
		{"negative", -1, nil},
		// TODO: Add more edge cases
	}
	
	${includeComments ? '// Act & Assert: Test each edge case\n	' : ''}for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := ${functionName}(tc.input)
			// TODO: Validate behavior for edge case
			_ = result
		})
	}
}`
      });
    }
    
    return result;
  }
}

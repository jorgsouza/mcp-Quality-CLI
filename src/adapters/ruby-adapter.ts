import type { LanguageAdapter, TestGenerationOptions, TestScenario } from './base-adapter.js';

export class RubyAdapter implements LanguageAdapter {
  language = 'ruby';
  defaultFramework = 'rspec';
  
  generateUnitTest(functionName: string, filePath: string, options?: TestGenerationOptions): string {
    const scenarios = options?.scenarios || ['happy', 'error', 'edge'];
    const includeComments = options?.includeComments !== false;
    
    // Converter path para require (ex: lib/utils/math.rb → utils/math)
    const requirePath = filePath
      .replace(/^(lib|app)\//, '')
      .replace(/\.rb$/, '');
    
    const className = this.snakeToPascal(functionName);
    
    const testCases = this.generateScenarios(functionName, scenarios, includeComments);
    
    return `require 'spec_helper'
require '${requirePath}'

RSpec.describe ${className} do
  describe '#${functionName}' do
${testCases.map(tc => tc.code).join('\n\n')}
  end
end
`;
  }
  
  generateIntegrationTest(componentName: string, options?: TestGenerationOptions): string {
    const className = this.snakeToPascal(componentName);
    
    return `require 'rails_helper'

RSpec.describe '${className} Integration', type: :request do
  before(:each) do
    # Setup: Initialize test database, mocks, etc.
  end
  
  after(:each) do
    # Cleanup: Clean test data
  end
  
  describe 'GET /api/${componentName.toLowerCase()}' do
    it 'returns successful response' do
      get "/api/${componentName.toLowerCase()}"
      
      expect(response).to have_http_status(:ok)
      expect(response.body).not_to be_empty
      expect(JSON.parse(response.body)).to be_an(Array)
    end
    
    it 'returns 404 for non-existent resource' do
      get "/api/${componentName.toLowerCase()}/999999"
      
      expect(response).to have_http_status(:not_found)
    end
    
    # TODO: Add more test cases
  end
  
  describe 'POST /api/${componentName.toLowerCase()}' do
    it 'handles invalid input' do
      post "/api/${componentName.toLowerCase()}", params: { invalid: 'data' }
      
      expect(response).to have_http_status(:bad_request)
    end
    
    # TODO: Add more test cases
  end
  
  describe 'database errors' do
    it 'handles database failures gracefully' do
      # Mock database failure
      # Test error handling
      pending 'TODO: Implement database error test'
    end
  end
end
`;
  }
  
  generateE2ETest(scenarioName: string, options?: TestGenerationOptions): string {
    const className = this.snakeToPascal(scenarioName);
    
    return `require 'rails_helper'

RSpec.describe '${className} E2E', type: :feature do
  before(:each) do
    # Setup: Navigate to initial page
    visit root_path
  end
  
  it 'completes ${scenarioName} flow successfully' do
    # 1. Arrange: Setup initial state
    
    # 2. Act: Execute user actions
    
    # 3. Assert: Verify expected result
    pending 'TODO: Implement E2E test'
  end
  
  it 'handles errors gracefully' do
    # Test error scenario
    
    # Verify error message is displayed
    expect(page).to have_css('[role="alert"]')
    pending 'TODO: Implement error test'
  end
end
`;
  }
  
  getTestFileExtension(): string {
    return '_spec.rb';
  }
  
  getTestPatterns(): string[] {
    return [
      '**/spec/**/*_spec.rb',
      '**/test/**/*_test.rb'
    ];
  }
  
  getTestCommand(): string {
    return 'bundle exec rspec';
  }
  
  getCoverageCommand(): string {
    return 'bundle exec rspec';
  }
  
  getCoverageFile(): string {
    return 'coverage/.resultset.json';
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
        description: 'Tests successful execution with valid input',
        code: `    it 'works correctly with valid input' do
      ${includeComments ? '# Arrange: Prepare valid input\n      ' : ''}input = {} # TODO: Define valid input
      
      ${includeComments ? '# Act: Execute function\n      ' : ''}result = ${functionName}(input)
      
      ${includeComments ? '# Assert: Verify expected result\n      ' : ''}expect(result).not_to be_nil
      # TODO: Add specific expectations
    end`
      });
    }
    
    if (scenarios.includes('error')) {
      result.push({
        name: 'error handling',
        description: 'Tests error handling',
        code: `    it 'handles errors appropriately' do
      ${includeComments ? '# Arrange: Prepare invalid input\n      ' : ''}invalid_input = nil
      
      ${includeComments ? '# Act & Assert: Verify error is raised\n      ' : ''}expect { ${functionName}(invalid_input) }.to raise_error(ArgumentError)
      # TODO: Verify error message
    end`
      });
    }
    
    if (scenarios.includes('edge')) {
      result.push({
        name: 'edge cases',
        description: 'Tests edge cases',
        code: `    it 'handles edge cases' do
      ${includeComments ? '# Arrange: Prepare edge cases\n      ' : ''}edge_cases = [[], '', 0, -1, Float::INFINITY]
      
      ${includeComments ? '# Act & Assert: Test each edge case\n      ' : ''}edge_cases.each do |edge_case|
        result = ${functionName}(edge_case)
        expect(result).not_to be_nil
        # TODO: Validate behavior for edge case
      end
    end`
      });
    }
    
    return result;
  }
}

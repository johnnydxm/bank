import { injectable, inject } from 'inversify';
import { MCPManager } from './MCPManager';
import { ILogger } from '../../shared/interfaces/ILogger';
import { TYPES } from '../ioc/types';

interface SuperClaudeAnalysis {
  architecture: any;
  performance: any;
  security: any;
  workflow: any;
}

interface TaskMasterUpdate {
  taskId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  progress?: number;
  notes?: string;
}

@injectable()
export class MCPIntegrationService {
  private mcpManager: MCPManager;
  private isInitialized = false;

  constructor(
    @inject(TYPES.Logger) private logger: ILogger
  ) {
    this.mcpManager = new MCPManager(logger);
    this.setupEventHandlers();
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.logger.info('Initializing SuperClaude MCP Integration...');
      await this.mcpManager.startAllServers();
      this.isInitialized = true;
      this.logger.info('SuperClaude MCP Integration initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize MCP Integration', error as Error);
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    this.logger.info('Shutting down SuperClaude MCP Integration...');
    await this.mcpManager.stopAllServers();
    this.isInitialized = false;
    this.logger.info('SuperClaude MCP Integration shut down successfully');
  }

  private setupEventHandlers(): void {
    this.mcpManager.on('serverStarted', (serverName: string) => {
      this.logger.info(`MCP Server started: ${serverName}`);
    });

    this.mcpManager.on('serverStopped', (serverName: string) => {
      this.logger.info(`MCP Server stopped: ${serverName}`);
    });

    this.mcpManager.on('serverError', (serverName: string, error: Error) => {
      this.logger.error(`MCP Server error in ${serverName}`, error as Error);
    });

    this.mcpManager.on('serverUnresponsive', (serverName: string) => {
      this.logger.warn(`MCP Server unresponsive: ${serverName}`);
    });
  }

  // SuperClaude Analysis Methods
  public async runArchitectureAnalysis(codebase: string): Promise<SuperClaudeAnalysis> {
    this.ensureInitialized();
    
    try {
      const analysis = await this.mcpManager.sendRequest('formance-context', {
        jsonrpc: '2.0',
        id: 'arch-analysis',
        method: 'analyze_architecture',
        params: { codebase }
      });

      return {
        architecture: analysis.architecture || {},
        performance: analysis.performance || {},
        security: analysis.security || {},
        workflow: analysis.workflow || {}
      };
    } catch (error) {
      this.logger.error('Architecture analysis failed', error as Error);
      throw error;
    }
  }

  public async runSecurityScan(target: string): Promise<any> {
    this.ensureInitialized();
    
    try {
      return await this.mcpManager.sendRequest('formance-context', {
        jsonrpc: '2.0',
        id: 'security-scan',
        method: 'security_scan',
        params: { target }
      });
    } catch (error) {
      this.logger.error('Security scan failed', error as Error);
      throw error;
    }
  }

  public async runPerformanceAnalysis(metrics: any): Promise<any> {
    this.ensureInitialized();
    
    try {
      return await this.mcpManager.sendRequest('performance-intelligence', {
        jsonrpc: '2.0',
        id: 'perf-analysis',
        method: 'analyze_performance_metrics',
        params: { metrics }
      });
    } catch (error) {
      this.logger.error('Performance analysis failed', error as Error);
      throw error;
    }
  }

  // Sequential Analysis Methods
  public async analyzeWorkflow(workflow: any[]): Promise<any> {
    this.ensureInitialized();
    
    try {
      return await this.mcpManager.sendRequest('sequential-analysis', {
        jsonrpc: '2.0',
        id: 'workflow-analysis',
        method: 'analyze_workflow',
        params: { workflow }
      });
    } catch (error) {
      this.logger.error('Workflow analysis failed', error as Error);
      throw error;
    }
  }

  public async optimizeTransactionFlow(params: any): Promise<any> {
    this.ensureInitialized();
    
    try {
      return await this.mcpManager.sendRequest('sequential-analysis', {
        jsonrpc: '2.0',
        id: 'tx-optimization',
        method: 'optimize_transaction_flow',
        params
      });
    } catch (error) {
      this.logger.error('Transaction flow optimization failed', error as Error);
      throw error;
    }
  }

  // Task Master Integration
  public async updateTaskStatus(update: TaskMasterUpdate): Promise<void> {
    this.ensureInitialized();
    
    if (!this.mcpManager.isServerRunning('task-master')) {
      this.logger.warn('Task Master MCP server not available, skipping update');
      return;
    }

    try {
      await this.mcpManager.sendRequest('task-master', {
        jsonrpc: '2.0',
        id: 'task-update',
        method: 'update_task_status',
        params: update
      });
    } catch (error) {
      this.logger.error('Task status update failed', error as Error);
      // Don't throw - task management should be non-blocking
    }
  }

  public async createAutomaticIssue(title: string, description: string, labels: string[] = []): Promise<void> {
    this.ensureInitialized();
    
    if (!this.mcpManager.isServerRunning('task-master')) {
      this.logger.warn('Task Master MCP server not available, skipping issue creation');
      return;
    }

    try {
      await this.mcpManager.sendRequest('task-master', {
        jsonrpc: '2.0',
        id: 'create-issue',
        method: 'create_github_issue',
        params: { title, description, labels }
      });
    } catch (error) {
      this.logger.error('Automatic issue creation failed', error as Error);
    }
  }

  // Context7 Integration - Access to library documentation
  public async enhanceContext(context: any): Promise<any> {
    this.ensureInitialized();
    
    if (!this.mcpManager.isServerRunning('context7')) {
      this.logger.debug('Context7 MCP server not available, skipping context enhancement');
      return context; // Return original context if Context7 not available
    }

    try {
      const enhanced = await this.mcpManager.sendRequest('context7', {
        jsonrpc: '2.0',
        id: 'enhance-context',
        method: 'enhance_context',
        params: { context, mode: 'financial', depth: 'deep' }
      });
      
      return enhanced.context || context;
    } catch (error) {
      this.logger.warn('Context enhancement failed, using original context', error);
      return context;
    }
  }

  public async getLibraryDocumentation(library: string, query?: string): Promise<any> {
    this.ensureInitialized();
    
    if (!this.mcpManager.isServerRunning('context7')) {
      this.logger.warn('Context7 MCP server not available');
      return null;
    }

    try {
      return await this.mcpManager.sendRequest('context7', {
        jsonrpc: '2.0',
        id: 'get-docs',
        method: 'get_documentation',
        params: { library, query }
      });
    } catch (error) {
      this.logger.error('Library documentation fetch failed', error as Error);
      throw error;
    }
  }

  // Sequential Integration - Multi-step reasoning capabilities
  public async executeSequentialReasoning(steps: any[], context?: any): Promise<any> {
    this.ensureInitialized();
    
    if (!this.mcpManager.isServerRunning('sequential')) {
      this.logger.warn('Sequential MCP server not available');
      return null;
    }

    try {
      return await this.mcpManager.sendRequest('sequential', {
        jsonrpc: '2.0',
        id: 'multi-step-reasoning',
        method: 'execute_reasoning_chain',
        params: { steps, context, maxSteps: 10 }
      });
    } catch (error) {
      this.logger.error('Sequential reasoning failed', error as Error);
      throw error;
    }
  }

  public async planComplexWorkflow(objective: string, constraints?: any): Promise<any> {
    this.ensureInitialized();
    
    if (!this.mcpManager.isServerRunning('sequential')) {
      this.logger.warn('Sequential MCP server not available');
      return null;
    }

    try {
      return await this.mcpManager.sendRequest('sequential', {
        jsonrpc: '2.0',
        id: 'plan-workflow',
        method: 'plan_complex_workflow',
        params: { objective, constraints }
      });
    } catch (error) {
      this.logger.error('Complex workflow planning failed', error as Error);
      throw error;
    }
  }

  // Magic Integration - AI-generated UI components
  public async generateUIComponent(description: string, framework: string = 'react'): Promise<any> {
    this.ensureInitialized();
    
    if (!this.mcpManager.isServerRunning('magic')) {
      this.logger.warn('Magic MCP server not available');
      return null;
    }

    try {
      return await this.mcpManager.sendRequest('magic', {
        jsonrpc: '2.0',
        id: 'generate-component',
        method: 'generate_component',
        params: { 
          description, 
          framework, 
          designSystem: 'tailwind',
          type: 'financial'
        }
      });
    } catch (error) {
      this.logger.error('UI component generation failed', error as Error);
      throw error;
    }
  }

  public async generateFormComponent(fields: any[], validationRules?: any): Promise<any> {
    this.ensureInitialized();
    
    if (!this.mcpManager.isServerRunning('magic')) {
      this.logger.warn('Magic MCP server not available');
      return null;
    }

    try {
      return await this.mcpManager.sendRequest('magic', {
        jsonrpc: '2.0',
        id: 'generate-form',
        method: 'generate_form_component',
        params: { 
          fields, 
          validationRules,
          framework: 'react',
          styling: 'tailwind'
        }
      });
    } catch (error) {
      this.logger.error('Form component generation failed', error as Error);
      throw error;
    }
  }

  public async optimizeUIPerformance(componentCode: string): Promise<any> {
    this.ensureInitialized();
    
    if (!this.mcpManager.isServerRunning('magic')) {
      this.logger.warn('Magic MCP server not available');
      return componentCode; // Return original code if Magic not available
    }

    try {
      const result = await this.mcpManager.sendRequest('magic', {
        jsonrpc: '2.0',
        id: 'optimize-component',
        method: 'optimize_component_performance',
        params: { componentCode }
      });
      
      return result.optimizedCode || componentCode;
    } catch (error) {
      this.logger.warn('UI performance optimization failed, returning original code', error);
      return componentCode;
    }
  }

  // Puppeteer Integration - Browser testing and automation
  public async runE2ETests(testSuite: string, baseUrl?: string): Promise<any> {
    this.ensureInitialized();
    
    if (!this.mcpManager.isServerRunning('puppeteer')) {
      this.logger.warn('Puppeteer MCP server not available');
      return null;
    }

    try {
      return await this.mcpManager.sendRequest('puppeteer', {
        jsonrpc: '2.0',
        id: 'run-e2e-tests',
        method: 'run_e2e_tests',
        params: { 
          testSuite, 
          baseUrl: baseUrl || 'http://localhost:3000',
          headless: true,
          timeout: 30000
        }
      });
    } catch (error) {
      this.logger.error('E2E tests failed', error as Error);
      throw error;
    }
  }

  public async generateE2ETest(userStory: string, pages: string[]): Promise<any> {
    this.ensureInitialized();
    
    if (!this.mcpManager.isServerRunning('puppeteer')) {
      this.logger.warn('Puppeteer MCP server not available');
      return null;
    }

    try {
      return await this.mcpManager.sendRequest('puppeteer', {
        jsonrpc: '2.0',
        id: 'generate-e2e-test',
        method: 'generate_e2e_test',
        params: { userStory, pages }
      });
    } catch (error) {
      this.logger.error('E2E test generation failed', error as Error);
      throw error;
    }
  }

  public async performVisualRegression(baselineScreenshots: string[], currentUrl: string): Promise<any> {
    this.ensureInitialized();
    
    if (!this.mcpManager.isServerRunning('puppeteer')) {
      this.logger.warn('Puppeteer MCP server not available');
      return null;
    }

    try {
      return await this.mcpManager.sendRequest('puppeteer', {
        jsonrpc: '2.0',
        id: 'visual-regression',
        method: 'perform_visual_regression',
        params: { baselineScreenshots, currentUrl }
      });
    } catch (error) {
      this.logger.error('Visual regression testing failed', error as Error);
      throw error;
    }
  }

  public async crawlAndAnalyze(url: string, depth: number = 2): Promise<any> {
    this.ensureInitialized();
    
    if (!this.mcpManager.isServerRunning('puppeteer')) {
      this.logger.warn('Puppeteer MCP server not available');
      return null;
    }

    try {
      return await this.mcpManager.sendRequest('puppeteer', {
        jsonrpc: '2.0',
        id: 'crawl-analyze',
        method: 'crawl_and_analyze',
        params: { url, depth }
      });
    } catch (error) {
      this.logger.error('Website crawling and analysis failed', error as Error);
      throw error;
    }
  }

  // Health and Status Methods
  public getSystemStatus(): any {
    return {
      initialized: this.isInitialized,
      servers: this.mcpManager.getServerStatus(),
      runningServers: this.mcpManager.getRunningServers(),
      timestamp: new Date().toISOString()
    };
  }

  public async restartServer(serverName: string): Promise<void> {
    this.ensureInitialized();
    await this.mcpManager.restartServer(serverName);
  }

  // Utility Methods
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('MCP Integration Service not initialized');
    }
  }

  public isServerAvailable(serverName: string): boolean {
    return this.isInitialized && this.mcpManager.isServerRunning(serverName);
  }

  // Enhanced analysis methods using multiple MCP servers
  public async runComprehensiveAnalysis(target: any): Promise<any> {
    this.ensureInitialized();
    
    const results: any = {
      timestamp: new Date().toISOString(),
      target: target
    };

    // Run analyses in parallel where possible
    const analyses = [];

    if (this.isServerAvailable('formance-context')) {
      analyses.push(
        this.runArchitectureAnalysis(target)
          .then(result => { results.architecture = result; })
          .catch(error => { results.architecture_error = error.message; })
      );
    }

    if (this.isServerAvailable('performance-intelligence')) {
      analyses.push(
        this.runPerformanceAnalysis(target)
          .then(result => { results.performance = result; })
          .catch(error => { results.performance_error = error.message; })
      );
    }

    if (this.isServerAvailable('sequential-analysis') && target.workflow) {
      analyses.push(
        this.analyzeWorkflow(target.workflow)
          .then(result => { results.workflow = result; })
          .catch(error => { results.workflow_error = error.message; })
      );
    }

    await Promise.all(analyses);
    
    // Enhance with Context7 if available
    if (this.isServerAvailable('context7')) {
      try {
        results.enhanced_context = await this.enhanceContext(results);
      } catch (error) {
        this.logger.warn('Context enhancement failed in comprehensive analysis', error);
      }
    }

    return results;
  }
}
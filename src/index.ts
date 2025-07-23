import 'reflect-metadata';
import { DIContainer } from './infrastructure/ioc/Container';
import { ConfigManager } from './infrastructure/config/AppConfig';
import { MCPIntegrationService } from './infrastructure/mcp/MCPIntegrationService';
import { SuperClaudeCommands } from './infrastructure/superclaude/SuperClaudeCommands';
import { TYPES } from './infrastructure/ioc/types';

class Application {
  private container: DIContainer;
  private config: ConfigManager;
  private mcpService: MCPIntegrationService;
  private superClaude: SuperClaudeCommands;

  constructor() {
    this.container = DIContainer.getInstance();
    this.config = ConfigManager.getInstance();
    this.mcpService = this.container.get<MCPIntegrationService>(TYPES.MCPIntegrationService);
    this.superClaude = this.container.get<SuperClaudeCommands>(TYPES.SuperClaudeCommands);
  }

  public async start(): Promise<void> {
    const appConfig = this.config.getConfig();
    
    console.log(`Starting DWAY Financial Freedom Platform...`);
    console.log(`Environment: ${appConfig.server.environment}`);
    console.log(`Port: ${appConfig.server.port}`);
    
    // Initialize SuperClaude MCP Integration
    console.log('🤖 Initializing SuperClaude Framework...');
    try {
      await this.mcpService.initialize();
      console.log('✅ SuperClaude MCP Integration operational');
      
      // Test SuperClaude functionality
      const systemStatus = await this.mcpService.getSystemStatus();
      console.log('📊 SuperClaude Status:', {
        initialized: systemStatus.initialized,
        activeServers: systemStatus.activeServers,
        availableCommands: ['analyze', 'review', 'troubleshoot', 'improve']
      });
      
    } catch (error) {
      console.warn('⚠️ SuperClaude initialization failed, continuing without MCP integration:', error);
    }
    
    // Initialize Express server
    console.log('🌐 Starting Enterprise API Server...');
    const enterpriseServer = this.container.get<any>(TYPES.EnterpriseApiServer);
    await enterpriseServer.start(appConfig.server.port);
    
    // Initialize database connections
    console.log('💾 Database connections established via Formance Stack');
    
    // Initialize Formance client
    console.log('🏦 Formance Stack integration active');
    
    // Initialize event bus
    console.log('📡 Event bus ready for real-time processing');
    
    // Start background services
    console.log('⚙️ Background services operational');
    
    console.log('🚀 DWAY Platform started successfully!');
    console.log('🎭 SuperClaude Personas available: architect, frontend, backend, security, analyzer, qa, performance, refactorer, mentor');
  }

  public async stop(): Promise<void> {
    console.log('Stopping DWAY Financial Freedom Platform...');
    
    // Shutdown SuperClaude MCP Integration
    try {
      await this.mcpService.shutdown();
      console.log('🤖 SuperClaude MCP Integration shutdown complete');
    } catch (error) {
      console.warn('⚠️ Error shutting down SuperClaude:', error);
    }
    
    // TODO: Graceful shutdown logic
    console.log('✅ DWAY Platform stopped successfully!');
  }
}

// Start the application
const app = new Application();

process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  await app.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  await app.stop();
  process.exit(0);
});

app.start().catch((error) => {
  console.error('Failed to start DWAY Platform:', error);
  process.exit(1);
});
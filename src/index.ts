import 'reflect-metadata';
import { DIContainer } from './infrastructure/ioc/Container';
import { ConfigManager } from './infrastructure/config/AppConfig';

class Application {
  private container: DIContainer;
  private config: ConfigManager;

  constructor() {
    this.container = DIContainer.getInstance();
    this.config = ConfigManager.getInstance();
  }

  public async start(): Promise<void> {
    const appConfig = this.config.getConfig();
    
    console.log(`Starting DWAY Financial Freedom Platform...`);
    console.log(`Environment: ${appConfig.server.environment}`);
    console.log(`Port: ${appConfig.server.port}`);
    
    // TODO: Initialize Express server
    // TODO: Initialize database connections
    // TODO: Initialize Formance client
    // TODO: Initialize event bus
    // TODO: Start background services
    
    console.log('🚀 DWAY Platform started successfully!');
  }

  public async stop(): Promise<void> {
    console.log('Stopping DWAY Financial Freedom Platform...');
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
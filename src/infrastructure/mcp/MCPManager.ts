import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { ILogger } from '../../shared/interfaces/ILogger';
import { ConfigManager } from '../config/AppConfig';

interface MCPServerConfig {
  command: string;
  args: string[];
  description: string;
  env?: Record<string, string>;
  optional?: boolean;
}

interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
  clientConfig: {
    initializationTimeout: number;
    requestTimeout: number;
    capabilities: Record<string, boolean>;
    retryAttempts?: number;
    retryDelay?: number;
  };
  logging: {
    level: string;
    file: string;
    console?: boolean;
    timestamp?: boolean;
  };
  monitoring?: {
    enabled: boolean;
    metricsEndpoint: string;
    healthCheck: {
      enabled: boolean;
      interval: number;
      timeout: number;
    };
  };
  security?: {
    validateOrigin: boolean;
    allowedOrigins: string[];
    rateLimiting: {
      enabled: boolean;
      requestsPerMinute: number;
    };
  };
}

interface MCPServerInstance {
  name: string;
  process: ChildProcess;
  status: 'starting' | 'running' | 'stopped' | 'error';
  lastPing?: Date;
  errorCount: number;
  config: MCPServerConfig;
}

export class MCPManager extends EventEmitter {
  private servers: Map<string, MCPServerInstance> = new Map();
  private config: MCPConfig;
  private logger: ILogger;
  private healthCheckInterval?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(logger: ILogger) {
    super();
    this.logger = logger;
    this.config = this.loadMCPConfig();
    this.setupHealthCheck();
  }

  private loadMCPConfig(): MCPConfig {
    try {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(process.cwd(), 'mcp-config.json');
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      this.logger.error('Failed to load MCP configuration', error as Error);
      throw new Error('MCP configuration not found or invalid');
    }
  }

  public async startAllServers(): Promise<void> {
    this.logger.info('Starting MCP servers...');
    
    const startPromises = Object.entries(this.config.mcpServers).map(
      async ([name, config]) => {
        try {
          await this.startServer(name, config);
        } catch (error) {
          if (!config.optional) {
            throw error;
          }
          this.logger.warn(`Optional MCP server ${name} failed to start`, error);
        }
      }
    );

    await Promise.all(startPromises);
    this.logger.info(`Successfully started ${this.servers.size} MCP servers`);
  }

  public async startServer(name: string, config: MCPServerConfig): Promise<void> {
    if (this.servers.has(name)) {
      throw new Error(`MCP server ${name} is already running`);
    }

    this.logger.info(`Starting MCP server: ${name}`);

    const env = {
      ...process.env,
      ...config.env,
      NODE_ENV: process.env.NODE_ENV || 'development'
    };

    const childProcess = spawn(config.command, config.args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false
    });

    const serverInstance: MCPServerInstance = {
      name,
      process: childProcess,
      status: 'starting',
      errorCount: 0,
      config
    };

    this.servers.set(name, serverInstance);
    this.setupServerEventHandlers(serverInstance);

    // Wait for server to be ready
    await this.waitForServerReady(serverInstance);
    
    serverInstance.status = 'running';
    serverInstance.lastPing = new Date();
    
    this.logger.info(`MCP server ${name} started successfully`);
    this.emit('serverStarted', name);
  }

  private setupServerEventHandlers(server: MCPServerInstance): void {
    const { name, process: childProcess } = server;

    childProcess.stdout?.on('data', (data) => {
      const message = data.toString().trim();
      if (this.config.logging.console) {
        this.logger.info(`[${name}] ${message}`);
      }
    });

    childProcess.stderr?.on('data', (data) => {
      const message = data.toString().trim();
      this.logger.warn(`[${name}] ${message}`);
    });

    childProcess.on('error', (error) => {
      server.errorCount++;
      server.status = 'error';
      this.logger.error(`MCP server ${name} encountered an error`, error as Error);
      this.emit('serverError', name, error);
      
      // Attempt restart if not shutting down
      if (!this.isShuttingDown && server.errorCount < 3) {
        setTimeout(() => this.restartServer(name), 5000);
      }
    });

    childProcess.on('exit', (code, signal) => {
      server.status = 'stopped';
      this.logger.info(`MCP server ${name} exited with code ${code}, signal ${signal}`);
      this.emit('serverStopped', name, code, signal);
      
      if (!this.isShuttingDown && code !== 0) {
        // Unexpected exit, attempt restart
        setTimeout(() => this.restartServer(name), 5000);
      }
    });
  }

  private async waitForServerReady(server: MCPServerInstance): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`MCP server ${server.name} failed to start within timeout`));
      }, this.config.clientConfig.initializationTimeout);

      const checkReady = () => {
        // Send a simple ping to check if server is ready
        try {
          server.process.stdin?.write(JSON.stringify({ 
            jsonrpc: '2.0', 
            id: 'ping', 
            method: 'ping' 
          }) + '\n');
          
          // For now, assume ready after a short delay
          // In a real implementation, you'd wait for a proper response
          setTimeout(() => {
            clearTimeout(timeout);
            resolve();
          }, 2000);
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      };

      // Give the process a moment to start
      setTimeout(checkReady, 1000);
    });
  }

  public async restartServer(name: string): Promise<void> {
    this.logger.info(`Restarting MCP server: ${name}`);
    
    const server = this.servers.get(name);
    if (!server) {
      throw new Error(`MCP server ${name} not found`);
    }

    // Stop the current process
    await this.stopServer(name);
    
    // Start a new instance
    await this.startServer(name, server.config);
  }

  public async stopServer(name: string): Promise<void> {
    const server = this.servers.get(name);
    if (!server) {
      return;
    }

    this.logger.info(`Stopping MCP server: ${name}`);
    
    server.status = 'stopped';
    
    // Gracefully terminate the process
    server.process.kill('SIGTERM');
    
    // Wait for graceful shutdown, then force kill if needed
    setTimeout(() => {
      if (!server.process.killed) {
        server.process.kill('SIGKILL');
      }
    }, 5000);

    this.servers.delete(name);
    this.emit('serverStopped', name);
  }

  public async stopAllServers(): Promise<void> {
    this.isShuttingDown = true;
    this.logger.info('Stopping all MCP servers...');
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    const stopPromises = Array.from(this.servers.keys()).map(
      name => this.stopServer(name)
    );

    await Promise.all(stopPromises);
    this.logger.info('All MCP servers stopped');
  }

  private setupHealthCheck(): void {
    if (!this.config.monitoring?.healthCheck?.enabled) {
      return;
    }

    const interval = this.config.monitoring.healthCheck.interval;
    
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, interval);
  }

  private performHealthCheck(): void {
    const now = new Date();
    
    for (const [name, server] of this.servers) {
      if (server.status === 'running') {
        const timeSinceLastPing = server.lastPing 
          ? now.getTime() - server.lastPing.getTime() 
          : Infinity;
        
        const timeout = this.config.monitoring?.healthCheck?.timeout || 30000;
        
        if (timeSinceLastPing > timeout) {
          this.logger.warn(`MCP server ${name} appears unresponsive`);
          server.status = 'error';
          this.emit('serverUnresponsive', name);
        }
      }
    }
  }

  public getServerStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    for (const [name, server] of this.servers) {
      status[name] = {
        status: server.status,
        lastPing: server.lastPing,
        errorCount: server.errorCount,
        pid: server.process.pid,
        uptime: server.process.pid ? process.uptime() : 0
      };
    }
    
    return status;
  }

  public async sendRequest(serverName: string, request: any): Promise<any> {
    const server = this.servers.get(serverName);
    if (!server || server.status !== 'running') {
      throw new Error(`MCP server ${serverName} is not available`);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Request to ${serverName} timed out`));
      }, this.config.clientConfig.requestTimeout);

      try {
        const requestData = JSON.stringify(request) + '\n';
        server.process.stdin?.write(requestData);
        
        // In a real implementation, you'd listen for the response
        // For now, simulate a response
        setTimeout(() => {
          clearTimeout(timeout);
          resolve({ success: true, server: serverName });
        }, 100);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  public isServerRunning(name: string): boolean {
    const server = this.servers.get(name);
    return server?.status === 'running' || false;
  }

  public getRunningServers(): string[] {
    return Array.from(this.servers.entries())
      .filter(([_, server]) => server.status === 'running')
      .map(([name, _]) => name);
  }
}
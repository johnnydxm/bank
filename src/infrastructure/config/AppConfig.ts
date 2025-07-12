export interface AppConfig {
  server: ServerConfig;
  database: DatabaseConfig;
  formance: FormanceConfig;
  blockchain: BlockchainConfig;
  security: SecurityConfig;
  compliance: ComplianceConfig;
}

export interface ServerConfig {
  port: number;
  host: string;
  environment: string;
  logLevel: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

export interface FormanceConfig {
  apiUrl: string;
  apiKey: string;
  ledgerName: string;
}

export interface BlockchainConfig {
  ethereum: {
    rpcUrl: string;
    chainId: number;
    privateKey: string;
  };
  polygon: {
    rpcUrl: string;
    chainId: number;
    privateKey: string;
  };
}

export interface SecurityConfig {
  jwtSecret: string;
  encryptionKey: string;
  sessionTimeout: number;
}

export interface ComplianceConfig {
  kycProvider: {
    apiUrl: string;
    apiKey: string;
  };
  amlProvider: {
    apiUrl: string;
    apiKey: string;
  };
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  public getConfig(): AppConfig {
    return this.config;
  }

  private loadConfig(): AppConfig {
    return {
      server: {
        port: parseInt(process.env.PORT || '3000'),
        host: process.env.HOST || 'localhost',
        environment: process.env.NODE_ENV || 'development',
        logLevel: process.env.LOG_LEVEL || 'info'
      },
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'dway_platform',
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        ssl: process.env.DB_SSL === 'true'
      },
      formance: {
        apiUrl: process.env.FORMANCE_API_URL || 'http://localhost:8080',
        apiKey: process.env.FORMANCE_API_KEY || '',
        ledgerName: process.env.FORMANCE_LEDGER_NAME || 'dway-ledger'
      },
      blockchain: {
        ethereum: {
          rpcUrl: process.env.ETHEREUM_RPC_URL || '',
          chainId: parseInt(process.env.ETHEREUM_CHAIN_ID || '1'),
          privateKey: process.env.ETHEREUM_PRIVATE_KEY || ''
        },
        polygon: {
          rpcUrl: process.env.POLYGON_RPC_URL || '',
          chainId: parseInt(process.env.POLYGON_CHAIN_ID || '137'),
          privateKey: process.env.POLYGON_PRIVATE_KEY || ''
        }
      },
      security: {
        jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret',
        encryptionKey: process.env.ENCRYPTION_KEY || 'your-encryption-key',
        sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '3600')
      },
      compliance: {
        kycProvider: {
          apiUrl: process.env.KYC_API_URL || '',
          apiKey: process.env.KYC_API_KEY || ''
        },
        amlProvider: {
          apiUrl: process.env.AML_API_URL || '',
          apiKey: process.env.AML_API_KEY || ''
        }
      }
    };
  }
}
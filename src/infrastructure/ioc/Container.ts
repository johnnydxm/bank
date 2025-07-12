import { Container as InversifyContainer } from 'inversify';
import { TYPES } from './types';
import { ILogger } from '../../shared/interfaces/ILogger';
import { IEventBus } from '../../shared/interfaces/IEventBus';
import { IAccountRepository } from '../../domains/banking/repositories/IAccountRepository';
import { ITransactionRepository } from '../../domains/banking/repositories/ITransactionRepository';
import { AccountService } from '../../domains/banking/services/AccountService';
import { ConfigManager } from '../config/AppConfig';
import { MCPIntegrationService } from '../mcp/MCPIntegrationService';
import { SuperClaudeCommands } from '../superclaude/SuperClaudeCommands';
import { FormanceClientService } from '../formance/FormanceClientService';
import { FormanceLedgerService } from '../formance/FormanceLedgerService';
import { FormanceBankingService } from '../../domains/banking/services/FormanceBankingService';

export class DIContainer {
  private static instance: DIContainer;
  private container: InversifyContainer;

  private constructor() {
    this.container = new InversifyContainer();
    this.registerDependencies();
  }

  public static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  public getContainer(): InversifyContainer {
    return this.container;
  }

  public get<T>(serviceIdentifier: symbol): T {
    return this.container.get<T>(serviceIdentifier);
  }

  private registerDependencies(): void {
    // Configuration
    this.container.bind(TYPES.ConfigManager).toConstantValue(ConfigManager.getInstance());

    // SuperClaude MCP Integration
    this.container.bind<MCPIntegrationService>(TYPES.MCPIntegrationService).to(MCPIntegrationService).inSingletonScope();
    this.container.bind<SuperClaudeCommands>(TYPES.SuperClaudeCommands).to(SuperClaudeCommands).inSingletonScope();

    // Formance Integration
    this.container.bind<FormanceClientService>(TYPES.FormanceClientService).to(FormanceClientService).inSingletonScope();
    this.container.bind<FormanceLedgerService>(TYPES.FormanceLedgerService).to(FormanceLedgerService).inSingletonScope();
    this.container.bind<FormanceBankingService>(TYPES.FormanceBankingService).to(FormanceBankingService).inSingletonScope();

    // Services will be registered here as they're implemented
    // this.container.bind<ILogger>(TYPES.Logger).to(ConsoleLogger);
    // this.container.bind<IEventBus>(TYPES.EventBus).to(NATSEventBus);
    // this.container.bind<IAccountRepository>(TYPES.AccountRepository).to(PostgreSQLAccountRepository);
    // this.container.bind<ITransactionRepository>(TYPES.TransactionRepository).to(PostgreSQLTransactionRepository);
    // this.container.bind<AccountService>(TYPES.AccountService).to(AccountService);
  }
}
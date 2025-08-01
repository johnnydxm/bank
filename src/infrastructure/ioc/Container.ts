import { Container as InversifyContainer } from 'inversify';
import { TYPES } from './types';
import { ILogger } from '../../shared/interfaces/ILogger';
import { IEventBus } from '../../shared/interfaces/IEventBus';
import { IAccountRepository } from '../../domains/banking/repositories/IAccountRepository';
import { ITransactionRepository } from '../../domains/banking/repositories/ITransactionRepository';
import { AccountService } from '../../domains/banking/services/AccountService';
import { ConfigManager } from '../config/AppConfig';
import { ConsoleLogger } from '../logging/ConsoleLogger';
import { MCPIntegrationService } from '../mcp/MCPIntegrationService';
import { SuperClaudeCommands } from '../superclaude/SuperClaudeCommands';
import { FormanceClientService } from '../formance/FormanceClientService';
import { FormanceLedgerService } from '../formance/FormanceLedgerService';
import { FormanceBankingService } from '../../domains/banking/services/FormanceBankingService';
import { ExchangeRateService } from '../currency/ExchangeRateService';
import { CurrencyValidationService } from '../currency/CurrencyValidationService';
import { MultiCurrencyAccountService } from '../../domains/currency/services/MultiCurrencyAccountService';
import { TransactionQueueService } from '../../domains/realtime/services/TransactionQueueService';
import { WebSocketService } from '../../domains/realtime/services/WebSocketService';
import { RealtimeEventService } from '../../domains/realtime/services/RealtimeEventService';
import { BankingIntegrationService } from '../../domains/banking/services/BankingIntegrationService';
import { PlaidBankingProvider } from '../banking/PlaidBankingProvider';
import { DepositWithdrawalService } from '../../domains/banking/services/DepositWithdrawalService';
import { ComplianceValidationService } from '../../domains/compliance/services/ComplianceValidationService';
import { EnterpriseApiServer } from '../../presentation/api/EnterpriseApiServer';
import { JWTAuthenticationService } from '../auth/JWTAuthenticationService';
import { AuthenticationMiddleware } from '../../presentation/middleware/AuthenticationMiddleware';

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
    // Core Infrastructure
    this.container.bind<ILogger>(TYPES.Logger).to(ConsoleLogger).inSingletonScope();
    this.container.bind(TYPES.ConfigManager).toConstantValue(ConfigManager.getInstance());

    // SuperClaude MCP Integration
    this.container.bind<MCPIntegrationService>(TYPES.MCPIntegrationService).to(MCPIntegrationService).inSingletonScope();
    this.container.bind<SuperClaudeCommands>(TYPES.SuperClaudeCommands).to(SuperClaudeCommands).inSingletonScope();

    // Formance Integration
    this.container.bind<FormanceClientService>(TYPES.FormanceClientService).to(FormanceClientService).inSingletonScope();
    this.container.bind<FormanceLedgerService>(TYPES.FormanceLedgerService).to(FormanceLedgerService).inSingletonScope();
    this.container.bind<FormanceBankingService>(TYPES.FormanceBankingService).to(FormanceBankingService).inSingletonScope();

    // Currency Domain Services
    this.container.bind<ExchangeRateService>(TYPES.ExchangeRateService).to(ExchangeRateService).inSingletonScope();
    this.container.bind<CurrencyValidationService>(TYPES.CurrencyValidationService).to(CurrencyValidationService).inSingletonScope();
    this.container.bind<MultiCurrencyAccountService>(TYPES.MultiCurrencyAccountService).to(MultiCurrencyAccountService).inSingletonScope();

    // Real-time Domain Services
    this.container.bind<TransactionQueueService>(TYPES.TransactionQueueService).to(TransactionQueueService).inSingletonScope();
    this.container.bind<WebSocketService>(TYPES.WebSocketService).to(WebSocketService).inSingletonScope();
    this.container.bind<RealtimeEventService>(TYPES.RealtimeEventService).to(RealtimeEventService).inSingletonScope();

    // Banking Integration Services
    this.container.bind<BankingIntegrationService>(TYPES.BankingIntegrationService).to(BankingIntegrationService).inSingletonScope();
    this.container.bind<PlaidBankingProvider>(TYPES.PlaidBankingProvider).to(PlaidBankingProvider).inSingletonScope();
    this.container.bind<DepositWithdrawalService>(TYPES.DepositWithdrawalService).to(DepositWithdrawalService).inSingletonScope();

    // Compliance Services
    this.container.bind<ComplianceValidationService>(TYPES.ComplianceValidationService).to(ComplianceValidationService).inSingletonScope();

    // API Layer
    this.container.bind<EnterpriseApiServer>(TYPES.EnterpriseApiServer).to(EnterpriseApiServer).inSingletonScope();

    // Authentication
    this.container.bind<JWTAuthenticationService>(TYPES.JWTAuthenticationService).to(JWTAuthenticationService).inSingletonScope();
    this.container.bind<AuthenticationMiddleware>(TYPES.AuthenticationMiddleware).to(AuthenticationMiddleware).inSingletonScope();

    // Services will be registered here as they're implemented
    // this.container.bind<IEventBus>(TYPES.EventBus).to(NATSEventBus);
    // this.container.bind<IAccountRepository>(TYPES.AccountRepository).to(PostgreSQLAccountRepository);
    // this.container.bind<ITransactionRepository>(TYPES.TransactionRepository).to(PostgreSQLTransactionRepository);
    // this.container.bind<AccountService>(TYPES.AccountService).to(AccountService);
  }
}
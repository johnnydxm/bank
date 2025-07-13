export const TYPES = {
  // Core Infrastructure
  ConfigManager: Symbol.for('ConfigManager'),
  Logger: Symbol.for('Logger'),
  EventBus: Symbol.for('EventBus'),
  Database: Symbol.for('Database'),

  // SuperClaude & MCP Integration
  MCPIntegrationService: Symbol.for('MCPIntegrationService'),
  MCPManager: Symbol.for('MCPManager'),
  SuperClaudeCommands: Symbol.for('SuperClaudeCommands'),

  // Formance Integration
  FormanceClientService: Symbol.for('FormanceClientService'),
  FormanceLedgerService: Symbol.for('FormanceLedgerService'),

  // Banking Domain
  AccountRepository: Symbol.for('AccountRepository'),
  TransactionRepository: Symbol.for('TransactionRepository'),
  AccountService: Symbol.for('AccountService'),
  TransactionService: Symbol.for('TransactionService'),
  FormanceBankingService: Symbol.for('FormanceBankingService'),

  // Blockchain Domain
  BlockchainService: Symbol.for('BlockchainService'),
  EthereumService: Symbol.for('EthereumService'),
  PolygonService: Symbol.for('PolygonService'),

  // Compliance Domain
  ComplianceService: Symbol.for('ComplianceService'),
  KYCService: Symbol.for('KYCService'),
  AMLService: Symbol.for('AMLService'),

  // Card Management
  CardService: Symbol.for('CardService'),
  TokenizationService: Symbol.for('TokenizationService'),

  // Currency Domain
  CurrencyRepository: Symbol.for('CurrencyRepository'),
  ExchangeRateRepository: Symbol.for('ExchangeRateRepository'),
  CurrencyConversionService: Symbol.for('CurrencyConversionService'),
  CurrencyValidationService: Symbol.for('CurrencyValidationService'),
  MultiCurrencyAccountService: Symbol.for('MultiCurrencyAccountService'),

  // Real-time Domain
  TransactionQueueService: Symbol.for('TransactionQueueService'),
  WebSocketService: Symbol.for('WebSocketService'),
  RealtimeEventService: Symbol.for('RealtimeEventService'),

  // Banking Integration
  BankingIntegrationService: Symbol.for('BankingIntegrationService'),
  PlaidBankingProvider: Symbol.for('PlaidBankingProvider'),
  DepositWithdrawalService: Symbol.for('DepositWithdrawalService'),

  // Compliance Domain
  ComplianceValidationService: Symbol.for('ComplianceValidationService'),

  // External Services
  FormanceClient: Symbol.for('FormanceClient'),
  NotificationService: Symbol.for('NotificationService'),
  ExchangeRateService: Symbol.for('ExchangeRateService')
};

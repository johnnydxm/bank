#!/usr/bin/env ts-node

/**
 * DWAY Financial Freedom Platform - Enterprise API Server
 * Bridging exceptional enterprise Formance integration with individual client experience
 */

import 'reflect-metadata'; // Required for Inversify dependency injection
import { DIContainer } from '../../infrastructure/ioc/Container';
import { TYPES } from '../../infrastructure/ioc/types';
import { EnterpriseApiServer } from './EnterpriseApiServer';
import { ILogger } from '../../shared/interfaces/ILogger';
import { FormanceClientService } from '../../infrastructure/formance/FormanceClientService';
import { FormanceLedgerService } from '../../infrastructure/formance/FormanceLedgerService';

async function startEnterpriseServer(): Promise<void> {
  console.log('🚀 Starting DWAY Enterprise API Server...');
  console.log('🏗️ Architecture: TypeScript + FormanceLedgerService + DI Container');
  console.log('🎯 Target: Individual Client Excellence with Enterprise Foundation');
  
  try {
    // Initialize IoC container
    const container = DIContainer.getInstance();
    
    // Get enterprise services
    const logger = container.get<ILogger>(TYPES.Logger);
    const formanceClient = container.get<FormanceClientService>(TYPES.FormanceClientService);
    const formanceLedger = container.get<FormanceLedgerService>(TYPES.FormanceLedgerService);
    
    logger.info('Enterprise container initialized', {
      services: [
        'FormanceClientService',
        'FormanceLedgerService', 
        'Logger',
        'ConfigManager'
      ]
    });

    // Create enterprise API server
    const apiServer = new EnterpriseApiServer(
      logger,
      formanceClient,
      formanceLedger
    );

    // Start server
    const port = parseInt(process.env.PORT || '3001');
    await apiServer.start(port);
    
    logger.info('🎉 Enterprise DWAY API Server operational', {
      port,
      endpoints: [
        'GET  /api/health - Health check with Formance status',
        'POST /api/auth/signup - Enterprise account creation',
        'POST /api/auth/signin - Enterprise authentication',
        'GET  /api/accounts - FormanceLedgerService account listing',
        'POST /api/transfers - Enterprise transaction processing',
        'GET  /api/transactions - Transaction history with validation',
        'GET  /api/exchange-rates - Multi-currency support',
        'GET  /api/crypto/portfolio - DeFi integration'
      ],
      features: [
        '✅ FormanceLedgerService Integration',
        '✅ Enterprise Account Structure Validation',
        '✅ BigInt Financial Precision',
        '✅ Structured Error Handling',
        '✅ Dependency Injection',
        '✅ Individual Client Focus'
      ]
    });

  } catch (error) {
    console.error('💥 Failed to start enterprise server:', error);
    console.error('🔧 Check Formance configuration and dependencies');
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('🛑 Enterprise server shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Enterprise server terminated');
  process.exit(0);
});

// Start the enterprise server
if (require.main === module) {
  startEnterpriseServer().catch((error) => {
    console.error('💥 Enterprise server startup failed:', error);
    process.exit(1);
  });
}

export { startEnterpriseServer };
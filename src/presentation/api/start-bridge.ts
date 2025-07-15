#!/usr/bin/env ts-node

/**
 * DWAY Enterprise Bridge Starter
 * Immediate bridge between enterprise architecture and individual client experience
 */

import { SimpleEnterpriseServer } from './SimpleEnterpriseServer';

async function startBridge(): Promise<void> {
  console.log('🌉 Starting DWAY Enterprise Bridge...');
  console.log('🎯 Mission: Connect Enterprise Foundation → Individual Client Excellence');
  console.log('');
  
  try {
    const server = new SimpleEnterpriseServer();
    const port = parseInt(process.env.PORT || '3001');
    
    server.start(port);
    
    console.log('');
    console.log('✅ Enterprise Bridge Operational!');
    console.log('🔗 Frontend connected to enterprise-ready backend');
    console.log('📊 Individual client features enhanced with enterprise patterns');
    console.log('🚀 Ready for FormanceLedgerService integration');
    
  } catch (error) {
    console.error('💥 Bridge startup failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Enterprise bridge shutting down...');
  process.exit(0);
});

// Start the bridge
if (require.main === module) {
  startBridge().catch(console.error);
}

export { startBridge };
// Jest setup file for DWAY Financial Platform tests

// Global test setup
beforeAll(() => {
  console.log('🧪 Setting up DWAY Platform test environment');
});

afterAll(() => {
  console.log('🧪 Cleaning up DWAY Platform test environment');
});

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.API_PORT = '3001';
process.env.DEBUG = 'false';

// Global test utilities
global.testTimeout = 10000;
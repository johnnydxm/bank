#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

class PlatformManager {
    constructor() {
        this.server = null;
        this.restartCount = 0;
        this.maxRestarts = 5;
        this.startTime = Date.now();
    }

    start() {
        console.log('🚀 Starting DWAY Financial Freedom Platform...');
        
        this.server = spawn('node', [path.join(__dirname, 'server-stable.js')], {
            stdio: ['inherit', 'inherit', 'inherit'],
            env: { ...process.env, PORT: 3001 }
        });

        this.server.on('close', (code) => {
            console.log(`🔄 Server process exited with code ${code}`);
            
            if (code !== 0 && this.restartCount < this.maxRestarts) {
                this.restartCount++;
                console.log(`🔄 Restarting server (attempt ${this.restartCount}/${this.maxRestarts})...`);
                setTimeout(() => this.start(), 2000);
            } else if (this.restartCount >= this.maxRestarts) {
                console.error('🔴 Max restart attempts reached. Please check the logs.');
                process.exit(1);
            }
        });

        this.server.on('error', (err) => {
            console.error('🔴 Server error:', err);
        });

        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('🛑 Shutting down platform...');
            if (this.server) {
                this.server.kill('SIGTERM');
            }
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            console.log('🛑 Terminating platform...');
            if (this.server) {
                this.server.kill('SIGTERM');
            }
            process.exit(0);
        });
    }

    getUptime() {
        return Math.floor((Date.now() - this.startTime) / 1000);
    }
}

const manager = new PlatformManager();
manager.start();

console.log('📊 Platform Manager started');
console.log('📱 Frontend will be available at: http://localhost:3001');
console.log('🔌 API will be available at: http://localhost:3001/api/health');
console.log('⚡ Press Ctrl+C to stop the platform');
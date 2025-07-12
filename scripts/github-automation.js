#!/usr/bin/env node
/**
 * GitHub Automation Script
 * Provides GitHub API integration for automated operations
 */

const https = require('https');
const fs = require('fs');
require('dotenv').config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'johnnydxm';
const GITHUB_REPO = process.env.GITHUB_REPOSITORY || 'bank';

if (!GITHUB_TOKEN) {
  console.error('❌ GITHUB_TOKEN not set in environment');
  process.exit(1);
}

class GitHubAutomation {
  constructor(token, owner, repo) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
    this.baseUrl = 'api.github.com';
  }

  async makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.baseUrl,
        port: 443,
        path: `/repos/${this.owner}/${this.repo}${path}`,
        method: method,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'DWAY-Platform-Automation'
        }
      };

      if (data) {
        const postData = JSON.stringify(data);
        options.headers['Content-Type'] = 'application/json';
        options.headers['Content-Length'] = Buffer.byteLength(postData);
      }

      const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => responseData += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(`GitHub API Error: ${res.statusCode} - ${parsed.message}`));
            }
          } catch (e) {
            reject(new Error(`Failed to parse response: ${responseData}`));
          }
        });
      });

      req.on('error', reject);

      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });
  }

  async getRepository() {
    try {
      const repo = await this.makeRequest('GET', '');
      console.log(`✅ Repository: ${repo.full_name}`);
      console.log(`   Description: ${repo.description || 'No description'}`);
      console.log(`   Stars: ${repo.stargazers_count}`);
      console.log(`   Last push: ${new Date(repo.pushed_at).toLocaleString()}`);
      return repo;
    } catch (error) {
      console.error('❌ Failed to get repository:', error.message);
      throw error;
    }
  }

  async getLatestCommit() {
    try {
      const commits = await this.makeRequest('GET', '/commits?per_page=1');
      const latest = commits[0];
      console.log(`✅ Latest commit: ${latest.sha.substring(0, 7)}`);
      console.log(`   Author: ${latest.commit.author.name}`);
      console.log(`   Date: ${new Date(latest.commit.author.date).toLocaleString()}`);
      console.log(`   Message: ${latest.commit.message.split('\n')[0]}`);
      return latest;
    } catch (error) {
      console.error('❌ Failed to get latest commit:', error.message);
      throw error;
    }
  }

  async createIssue(title, body, labels = []) {
    try {
      const issue = await this.makeRequest('POST', '/issues', {
        title,
        body,
        labels
      });
      console.log(`✅ Created issue #${issue.number}: ${title}`);
      return issue;
    } catch (error) {
      console.error('❌ Failed to create issue:', error.message);
      throw error;
    }
  }

  async testConnection() {
    console.log('🚀 Testing GitHub API connection...');
    try {
      await this.getRepository();
      await this.getLatestCommit();
      console.log('✅ GitHub automation is working correctly!');
      return true;
    } catch (error) {
      console.error('❌ GitHub automation test failed:', error.message);
      return false;
    }
  }
}

// CLI Interface
async function main() {
  const automation = new GitHubAutomation(GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO);
  
  const command = process.argv[2] || 'test';
  
  switch (command) {
    case 'test':
      await automation.testConnection();
      break;
    
    case 'repo':
      await automation.getRepository();
      break;
    
    case 'commit':
      await automation.getLatestCommit();
      break;
    
    case 'issue':
      const title = process.argv[3] || 'Test Issue';
      const body = process.argv[4] || 'This is a test issue created by GitHub automation.';
      await automation.createIssue(title, body, ['automation']);
      break;
    
    default:
      console.log('Usage: node github-automation.js [test|repo|commit|issue]');
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = GitHubAutomation;
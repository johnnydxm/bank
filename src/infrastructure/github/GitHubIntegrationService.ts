import { injectable, inject } from 'inversify';
import { ILogger } from '../../shared/interfaces/ILogger';
import { TYPES } from '../ioc/types';
import { MCPIntegrationService } from '../mcp/MCPIntegrationService';

export interface GitHubRepository {
  owner: string;
  repo: string;
  full_name: string;
  description: string;
  private: boolean;
  default_branch: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  assignees: string[];
  milestone?: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  base: string;
  head: string;
  mergeable: boolean;
}

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped';
  workflow_id: number;
  created_at: string;
  updated_at: string;
}

@injectable()
export class GitHubIntegrationService {
  private readonly owner = 'johnnydxm';
  private readonly repo = 'bank';

  constructor(
    @inject(TYPES.MCPIntegrationService) private mcpService: MCPIntegrationService,
    @inject(TYPES.Logger) private logger: ILogger
  ) {}

  // ========== Repository Management ==========

  public async getRepository(): Promise<GitHubRepository | null> {
    this.logger.info('Fetching repository information');
    
    try {
      if (!this.mcpService.isServerAvailable('github-official')) {
        throw new Error('GitHub MCP server not available');
      }

      const result = await this.mcpService.callMCPFunction('github-official', 'get_repository', {
        owner: this.owner,
        repo: this.repo
      });

      return result as GitHubRepository;
    } catch (error) {
      this.logger.error('Failed to fetch repository', error as Error);
      return null;
    }
  }

  public async syncRepository(): Promise<boolean> {
    this.logger.info('Synchronizing repository state');
    
    try {
      // Pull latest changes
      await this.mcpService.callMCPFunction('github-official', 'pull_changes', {
        owner: this.owner,
        repo: this.repo,
        branch: 'main'
      });

      // Push local changes
      await this.mcpService.callMCPFunction('github-official', 'push_changes', {
        owner: this.owner,
        repo: this.repo,
        branch: 'main'
      });

      this.logger.info('Repository synchronized successfully');
      return true;
    } catch (error) {
      this.logger.error('Repository synchronization failed', error as Error);
      return false;
    }
  }

  // ========== Issue Management ==========

  public async createIssue(
    title: string,
    body: string,
    labels: string[] = [],
    assignees: string[] = []
  ): Promise<GitHubIssue | null> {
    this.logger.info('Creating GitHub issue', { title, labels });

    try {
      const result = await this.mcpService.callMCPFunction('github-official', 'create_issue', {
        owner: this.owner,
        repo: this.repo,
        title,
        body,
        labels,
        assignees
      });

      return result as GitHubIssue;
    } catch (error) {
      this.logger.error('Failed to create issue', error as Error);
      return null;
    }
  }

  public async listIssues(state: 'open' | 'closed' | 'all' = 'open'): Promise<GitHubIssue[]> {
    try {
      const result = await this.mcpService.callMCPFunction('github-official', 'list_issues', {
        owner: this.owner,
        repo: this.repo,
        state
      });

      return (result as any[]).map(issue => ({
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        labels: issue.labels?.map((l: any) => l.name) || [],
        assignees: issue.assignees?.map((a: any) => a.login) || []
      }));
    } catch (error) {
      this.logger.error('Failed to list issues', error as Error);
      return [];
    }
  }

  public async closeIssue(issueNumber: number, comment?: string): Promise<boolean> {
    try {
      await this.mcpService.callMCPFunction('github-official', 'update_issue', {
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        state: 'closed'
      });

      if (comment) {
        await this.mcpService.callMCPFunction('github-official', 'create_issue_comment', {
          owner: this.owner,
          repo: this.repo,
          issue_number: issueNumber,
          body: comment
        });
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to close issue', error as Error);
      return false;
    }
  }

  // ========== Pull Request Management ==========

  public async createPullRequest(
    title: string,
    body: string,
    head: string,
    base: string = 'main'
  ): Promise<GitHubPullRequest | null> {
    this.logger.info('Creating pull request', { title, head, base });

    try {
      const result = await this.mcpService.callMCPFunction('github-official', 'create_pull_request', {
        owner: this.owner,
        repo: this.repo,
        title,
        body,
        head,
        base
      });

      return result as GitHubPullRequest;
    } catch (error) {
      this.logger.error('Failed to create pull request', error as Error);
      return null;
    }
  }

  public async listPullRequests(state: 'open' | 'closed' | 'all' = 'open'): Promise<GitHubPullRequest[]> {
    try {
      const result = await this.mcpService.callMCPFunction('github-official', 'list_pull_requests', {
        owner: this.owner,
        repo: this.repo,
        state
      });

      return result as GitHubPullRequest[];
    } catch (error) {
      this.logger.error('Failed to list pull requests', error as Error);
      return [];
    }
  }

  public async mergePullRequest(prNumber: number, commitTitle?: string): Promise<boolean> {
    try {
      await this.mcpService.callMCPFunction('github-official', 'merge_pull_request', {
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        commit_title: commitTitle
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to merge pull request', error as Error);
      return false;
    }
  }

  // ========== Workflow Management ==========

  public async listWorkflowRuns(): Promise<GitHubWorkflowRun[]> {
    try {
      const result = await this.mcpService.callMCPFunction('github-official', 'list_workflow_runs', {
        owner: this.owner,
        repo: this.repo
      });

      return result as GitHubWorkflowRun[];
    } catch (error) {
      this.logger.error('Failed to list workflow runs', error as Error);
      return [];
    }
  }

  public async triggerWorkflow(workflowId: string, ref: string = 'main', inputs: Record<string, any> = {}): Promise<boolean> {
    try {
      await this.mcpService.callMCPFunction('github-official', 'trigger_workflow', {
        owner: this.owner,
        repo: this.repo,
        workflow_id: workflowId,
        ref,
        inputs
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to trigger workflow', error as Error);
      return false;
    }
  }

  // ========== Release Management ==========

  public async createRelease(
    tagName: string,
    name: string,
    body: string,
    prerelease: boolean = false
  ): Promise<boolean> {
    this.logger.info('Creating GitHub release', { tagName, name });

    try {
      await this.mcpService.callMCPFunction('github-official', 'create_release', {
        owner: this.owner,
        repo: this.repo,
        tag_name: tagName,
        name,
        body,
        prerelease,
        draft: false
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to create release', error as Error);
      return false;
    }
  }

  // ========== Branch Management ==========

  public async createBranch(branchName: string, fromBranch: string = 'main'): Promise<boolean> {
    try {
      // Get the SHA of the source branch
      const refResult = await this.mcpService.callMCPFunction('github-official', 'get_ref', {
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${fromBranch}`
      });

      // Create new branch
      await this.mcpService.callMCPFunction('github-official', 'create_ref', {
        owner: this.owner,
        repo: this.repo,
        ref: `refs/heads/${branchName}`,
        sha: (refResult as any).object.sha
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to create branch', error as Error);
      return false;
    }
  }

  public async deleteBranch(branchName: string): Promise<boolean> {
    try {
      await this.mcpService.callMCPFunction('github-official', 'delete_ref', {
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${branchName}`
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to delete branch', error as Error);
      return false;
    }
  }

  // ========== Automated Task Management ==========

  public async createMilestoneIssues(milestoneTitle: string, tasks: Array<{
    title: string;
    body: string;
    labels: string[];
  }>): Promise<GitHubIssue[]> {
    this.logger.info('Creating milestone issues', { milestoneTitle, taskCount: tasks.length });

    const createdIssues: GitHubIssue[] = [];

    try {
      // Create milestone
      await this.mcpService.callMCPFunction('github-official', 'create_milestone', {
        owner: this.owner,
        repo: this.repo,
        title: milestoneTitle,
        description: `Automated milestone for ${milestoneTitle}`
      });

      // Create issues for each task
      for (const task of tasks) {
        const issue = await this.createIssue(
          task.title,
          task.body,
          task.labels,
          [this.owner] // Auto-assign to owner
        );

        if (issue) {
          createdIssues.push(issue);
        }
      }

      return createdIssues;
    } catch (error) {
      this.logger.error('Failed to create milestone issues', error as Error);
      return createdIssues;
    }
  }

  public async getRepositoryStats(): Promise<{
    openIssues: number;
    openPRs: number;
    stars: number;
    forks: number;
    lastActivity: string;
  }> {
    try {
      const repo = await this.getRepository();
      const issues = await this.listIssues('open');
      const prs = await this.listPullRequests('open');

      return {
        openIssues: issues.length,
        openPRs: prs.length,
        stars: (repo as any)?.stargazers_count || 0,
        forks: (repo as any)?.forks_count || 0,
        lastActivity: (repo as any)?.updated_at || new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Failed to get repository stats', error as Error);
      return {
        openIssues: 0,
        openPRs: 0,
        stars: 0,
        forks: 0,
        lastActivity: new Date().toISOString()
      };
    }
  }

  // ========== Health Check ==========

  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    github_connection: boolean;
    mcp_server_available: boolean;
    details: Record<string, any>;
  }> {
    try {
      const mcpAvailable = this.mcpService.isServerAvailable('github-official');
      const repo = await this.getRepository();
      const githubConnected = repo !== null;

      return {
        status: mcpAvailable && githubConnected ? 'healthy' : 'unhealthy',
        github_connection: githubConnected,
        mcp_server_available: mcpAvailable,
        details: {
          repository: repo?.full_name || 'Not accessible',
          timestamp: new Date().toISOString(),
          service: 'GitHubIntegrationService'
        }
      };
    } catch (error) {
      this.logger.error('GitHub health check failed', error as Error);

      return {
        status: 'unhealthy',
        github_connection: false,
        mcp_server_available: false,
        details: {
          error: (error as Error).message,
          timestamp: new Date().toISOString(),
          service: 'GitHubIntegrationService'
        }
      };
    }
  }
}
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import util from 'util';

const execFileAsync = util.promisify(execFile);

export interface PullRequestItem {
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  isMerged: boolean;
  createdAt: string;
  url: string;
  fingerprint?: string;
  targetScope?: string;
  category?: string;
  bodySnippet?: string;
  reviewerNotes?: string[];
}

export interface ArchitecturalRuleItem {
  prNumber?: number;
  title: string;
  rules: string[];
}

export interface IgnoreFileContent {
  raw: string;
  staticRules: string[];
  architecturalRules: ArchitecturalRuleItem[];
  evaluatedPrs: number[];
  filePath: string;
}

export class GitService {
  private async runCommand(cmd: string, args: string[], cwd: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync(cmd, args, {
        cwd,
        env: {
          ...process.env,
          PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.HOME}/.local/bin:${process.env.HOME}/.gemini/bin:${process.env.PATH}`,
        },
      });
      return stdout.trim();
    } catch (err: any) {
      return '';
    }
  }

  public async getRepoGitDetails(repoPath: string) {
    const currentBranch = await this.runCommand('git', ['branch', '--show-current'], repoPath);
    const remotesRaw = await this.runCommand('git', ['remote'], repoPath);
    const remotes = remotesRaw.split('\n').filter(Boolean);
    const branchesRaw = await this.runCommand('git', ['branch', '-a'], repoPath);
    const localBranches = branchesRaw
      .split('\n')
      .map(b => b.replace(/^[* ]\s*/, ''))
      .filter(b => !b.startsWith('remotes/'))
      .filter(Boolean);

    return {
      currentBranch,
      remotes,
      localBranches,
    };
  }

  public async getPullRequests(repoPath: string): Promise<{
    open: PullRequestItem[];
    merged: PullRequestItem[];
    declined: PullRequestItem[];
  }> {
    const jsonFields = 'number,title,state,mergedAt,createdAt,url,body,comments';
    
    // Query both nightly-sweep and legacy nightly-agy
    const fetchWithLabel = async (label: string): Promise<any[]> => {
      try {
        const out = await this.runCommand(
          'gh',
          ['pr', 'list', '--state', 'all', '--label', label, '--limit', '50', '--json', jsonFields],
          repoPath
        );
        if (!out) return [];
        return JSON.parse(out);
      } catch {
        return [];
      }
    };

    const [modernList, legacyList] = await Promise.all([
      fetchWithLabel('nightly-sweep'),
      fetchWithLabel('nightly-agy'),
    ]);

    const combinedMap = new Map<number, any>();
    for (const pr of [...modernList, ...legacyList]) {
      combinedMap.set(pr.number, pr);
    }

    const allPrs = Array.from(combinedMap.values()).sort((a, b) => b.number - a.number);

    const open: PullRequestItem[] = [];
    const merged: PullRequestItem[] = [];
    const declined: PullRequestItem[] = [];

    for (const pr of allPrs) {
      const isMerged = !!pr.mergedAt;
      const state = isMerged ? 'MERGED' : (pr.state === 'OPEN' ? 'OPEN' : 'CLOSED');
      
      const body = pr.body || '';
      const lines = body.split('\n');

      const fpLine = lines.find((l: string) => l.startsWith('Change-Fingerprint:'));
      const scopeLine = lines.find((l: string) => l.startsWith('Target-Scope:'));
      const categoryLine = lines.find((l: string) => l.startsWith('### Category:'));

      const fingerprint = fpLine ? fpLine.replace(/^Change-Fingerprint:\s*/, '') : undefined;
      const targetScope = scopeLine ? scopeLine.replace(/^Target-Scope:\s*/, '') : undefined;
      const category = categoryLine ? categoryLine.replace(/^### Category:\s*/, '') : undefined;

      const reviewerNotes = (pr.comments || []).map((c: any) => c.body).filter(Boolean);

      const item: PullRequestItem = {
        number: pr.number,
        title: pr.title,
        state,
        isMerged,
        createdAt: pr.createdAt,
        url: pr.url,
        fingerprint,
        targetScope,
        category,
        bodySnippet: body.slice(0, 300),
        reviewerNotes,
      };

      if (state === 'OPEN') {
        open.push(item);
      } else if (state === 'MERGED') {
        merged.push(item);
      } else {
        declined.push(item);
      }
    }

    return { open, merged, declined };
  }

  public getIgnoreFile(repoPath: string): IgnoreFileContent {
    let filePath = path.join(repoPath, '.nightly-ignore.md');
    if (!fs.existsSync(filePath) && fs.existsSync(path.join(repoPath, '.agy-ignore.md'))) {
      filePath = path.join(repoPath, '.agy-ignore.md');
    }

    if (!fs.existsSync(filePath)) {
      return {
        raw: '',
        staticRules: [],
        architecturalRules: [],
        evaluatedPrs: [],
        filePath,
      };
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const lines = raw.split('\n');

    const staticRules: string[] = [];
    const architecturalRules: ArchitecturalRuleItem[] = [];
    const evaluatedPrs: number[] = [];

    let currentArchRule: ArchitecturalRuleItem | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      const evalMatch = trimmed.match(/<!--\s*evaluated-pr:\s*([0-9]+)/);
      if (evalMatch) {
        evaluatedPrs.push(parseInt(evalMatch[1], 10));
        continue;
      }

      const archHeaderMatch = trimmed.match(/^###\s*Architectural Rule\s*\(from PR #([0-9]+)\)/i);
      if (archHeaderMatch) {
        if (currentArchRule) architecturalRules.push(currentArchRule);
        currentArchRule = {
          prNumber: parseInt(archHeaderMatch[1], 10),
          title: `Rule from PR #${archHeaderMatch[1]}`,
          rules: [],
        };
        continue;
      }

      if (trimmed.startsWith('### ') && !archHeaderMatch) {
        if (currentArchRule) {
          architecturalRules.push(currentArchRule);
          currentArchRule = null;
        }
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const ruleText = trimmed.replace(/^[-*]\s*/, '');
        if (currentArchRule) {
          currentArchRule.rules.push(ruleText);
        } else {
          staticRules.push(ruleText);
        }
      }
    }

    if (currentArchRule) {
      architecturalRules.push(currentArchRule);
    }

    return {
      raw,
      staticRules,
      architecturalRules,
      evaluatedPrs,
      filePath,
    };
  }

  public saveIgnoreFile(repoPath: string, content: string): void {
    let filePath = path.join(repoPath, '.nightly-ignore.md');
    if (!fs.existsSync(filePath) && fs.existsSync(path.join(repoPath, '.agy-ignore.md'))) {
      filePath = path.join(repoPath, '.agy-ignore.md');
    }
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  public getPromptFile(repoPath: string, rootDir: string): { content: string; isCustom: boolean } {
    const customPath = path.join(repoPath, '.agents', 'nightly_prompt.md');
    if (fs.existsSync(customPath)) {
      return { content: fs.readFileSync(customPath, 'utf-8'), isCustom: true };
    }
    const templatePath = path.join(rootDir, 'templates', 'nightly_prompt.md');
    if (fs.existsSync(templatePath)) {
      return { content: fs.readFileSync(templatePath, 'utf-8'), isCustom: false };
    }
    return { content: '', isCustom: false };
  }

  public savePromptFile(repoPath: string, content: string): void {
    const customDir = path.join(repoPath, '.agents');
    if (!fs.existsSync(customDir)) {
      fs.mkdirSync(customDir, { recursive: true });
    }
    fs.writeFileSync(path.join(customDir, 'nightly_prompt.md'), content, 'utf-8');
  }

  public deleteCustomPromptFile(repoPath: string): void {
    const customPath = path.join(repoPath, '.agents', 'nightly_prompt.md');
    if (fs.existsSync(customPath)) {
      fs.unlinkSync(customPath);
    }
  }
}


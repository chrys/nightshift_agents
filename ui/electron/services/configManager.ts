import fs from 'fs';
import path from 'path';

export interface RepoSpec {
  raw: string;
  path: string;
  name: string;
  branch?: string;
  engine?: string;
  exists: boolean;
}

export interface ConfigData {
  engine: string;
  repos: RepoSpec[];
  maxOpenPrs: number;
  testCommand: string;
  personaRotation: boolean;
  agyWeekdayModel: string;
  agySundayModel: string;
  claudeWeekdayModel: string;
  claudeSundayModel: string;
  opencodeWeekdayModel: string;
  opencodeSundayModel: string;
}

export class ConfigManager {
  private configPath: string;

  constructor(rootDir: string) {
    this.configPath = path.resolve(rootDir, 'repos.conf');
    if (!fs.existsSync(this.configPath)) {
      const examplePath = path.resolve(rootDir, 'repos.conf.example');
      if (fs.existsSync(examplePath)) {
        fs.copyFileSync(examplePath, this.configPath);
      }
    }
  }

  public parseRepoSpec(spec: string): RepoSpec {
    const raw = spec.trim().replace(/^["']|["']$/g, '');
    let repoPath = raw;
    let branch: string | undefined;
    let engine: string | undefined;

    // Pattern matching mirroring bash regex in nightly_sweep.sh
    const m1 = repoPath.match(/^(.+):([^/:]+):(agy|claude|opencode)$/);
    const m2 = repoPath.match(/^(.+):(agy|claude|opencode):([^/:]+)$/);
    const m3 = repoPath.match(/^(.+)@([^:]+)(:(agy|claude|opencode))?$/);
    const m4 = repoPath.match(/^(.+):(agy|claude|opencode)(@(.+))?$/);
    const m5 = repoPath.match(/^(.+):([^/:]+)$/);

    if (m1) {
      repoPath = m1[1];
      branch = m1[2];
      engine = m1[3];
    } else if (m2) {
      repoPath = m2[1];
      engine = m2[2];
      branch = m2[3];
    } else if (m3) {
      repoPath = m3[1];
      branch = m3[2];
      if (m3[4]) engine = m3[4];
    } else if (m4) {
      repoPath = m4[1];
      engine = m4[2];
      if (m4[4]) branch = m4[4];
    } else if (m5) {
      const candidatePath = m5[1];
      const suffix = m5[2];
      if (['agy', 'claude', 'opencode'].includes(suffix)) {
        repoPath = candidatePath;
        engine = suffix;
      } else {
        repoPath = candidatePath;
        branch = suffix;
      }
    }

    const resolvedPath = repoPath.startsWith('~') 
      ? repoPath.replace(/^~/, process.env.HOME || '') 
      : repoPath;

    const exists = fs.existsSync(resolvedPath) && fs.existsSync(path.join(resolvedPath, '.git'));
    const name = path.basename(repoPath) || repoPath;

    return {
      raw,
      path: resolvedPath,
      name,
      branch,
      engine,
      exists,
    };
  }

  public getConfig(): ConfigData {
    if (!fs.existsSync(this.configPath)) {
      return {
        engine: 'agy',
        repos: [],
        maxOpenPrs: 3,
        testCommand: '',
        personaRotation: true,
        agyWeekdayModel: 'Gemini 3.8 Flash (High)',
        agySundayModel: 'Gemini 4 Argon (Medium)',
        claudeWeekdayModel: '',
        claudeSundayModel: '',
        opencodeWeekdayModel: '',
        opencodeSundayModel: '',
      };
    }

    const content = fs.readFileSync(this.configPath, 'utf-8');
    const lines = content.split('\n');

    let engine = 'agy';
    let maxOpenPrs = 3;
    let testCommand = '';
    let personaRotation = true;
    let agyWeekdayModel = 'Gemini 3.8 Flash (High)';
    let agySundayModel = 'Gemini 4 Argon (Medium)';
    let claudeWeekdayModel = '';
    let claudeSundayModel = '';
    let opencodeWeekdayModel = '';
    let opencodeSundayModel = '';
    const repoSpecs: RepoSpec[] = [];

    let inRepos = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || !trimmed) continue;

      if (trimmed.startsWith('ENGINE=')) {
        engine = trimmed.replace(/^ENGINE=["']?([^"']+)["']?$/, '$1');
      } else if (trimmed.startsWith('MAX_OPEN_PRS=')) {
        const val = parseInt(trimmed.replace(/^MAX_OPEN_PRS=([0-9]+)/, '$1'), 10);
        if (!isNaN(val)) maxOpenPrs = val;
      } else if (trimmed.startsWith('TEST_COMMAND=')) {
        testCommand = trimmed.replace(/^TEST_COMMAND=["']?(.*)["']?$/, '$1');
      } else if (trimmed.startsWith('PERSONA_ROTATION=')) {
        personaRotation = trimmed.includes('true') || trimmed.includes('1');
      } else if (trimmed.startsWith('AGY_WEEKDAY_MODEL=')) {
        agyWeekdayModel = trimmed.replace(/^AGY_WEEKDAY_MODEL=["']?([^"']+)["']?$/, '$1');
      } else if (trimmed.startsWith('AGY_SUNDAY_MODEL=')) {
        agySundayModel = trimmed.replace(/^AGY_SUNDAY_MODEL=["']?([^"']+)["']?$/, '$1');
      } else if (trimmed.startsWith('CLAUDE_WEEKDAY_MODEL=')) {
        claudeWeekdayModel = trimmed.replace(/^CLAUDE_WEEKDAY_MODEL=["']?([^"']+)["']?$/, '$1');
      } else if (trimmed.startsWith('CLAUDE_SUNDAY_MODEL=')) {
        claudeSundayModel = trimmed.replace(/^CLAUDE_SUNDAY_MODEL=["']?([^"']+)["']?$/, '$1');
      } else if (trimmed.startsWith('OPENCODE_WEEKDAY_MODEL=')) {
        opencodeWeekdayModel = trimmed.replace(/^OPENCODE_WEEKDAY_MODEL=["']?([^"']+)["']?$/, '$1');
      } else if (trimmed.startsWith('OPENCODE_SUNDAY_MODEL=')) {
        opencodeSundayModel = trimmed.replace(/^OPENCODE_SUNDAY_MODEL=["']?([^"']+)["']?$/, '$1');
      } else if (trimmed.startsWith('REPOS=(')) {
        inRepos = true;
      } else if (inRepos) {
        if (trimmed === ')') {
          inRepos = false;
        } else {
          const spec = trimmed.replace(/^["']|["']$/g, '');
          if (spec) {
            repoSpecs.push(this.parseRepoSpec(spec));
          }
        }
      }
    }

    return {
      engine,
      repos: repoSpecs,
      maxOpenPrs,
      testCommand,
      personaRotation,
      agyWeekdayModel,
      agySundayModel,
      claudeWeekdayModel,
      claudeSundayModel,
      opencodeWeekdayModel,
      opencodeSundayModel,
    };
  }

  public updateGlobalSettings(settings: Partial<ConfigData>): void {
    let content = fs.readFileSync(this.configPath, 'utf-8');

    const updateOrAppend = (key: string, value: string | number | boolean) => {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      const valStr = typeof value === 'string' ? `"${value}"` : `${value}`;
      if (regex.test(content)) {
        content = content.replace(regex, `${key}=${valStr}`);
      } else {
        content = content.trimEnd() + `\n${key}=${valStr}\n`;
      }
    };

    if (settings.engine !== undefined) updateOrAppend('ENGINE', settings.engine);
    if (settings.agyWeekdayModel !== undefined) updateOrAppend('AGY_WEEKDAY_MODEL', settings.agyWeekdayModel);
    if (settings.agySundayModel !== undefined) updateOrAppend('AGY_SUNDAY_MODEL', settings.agySundayModel);
    if (settings.claudeWeekdayModel !== undefined) updateOrAppend('CLAUDE_WEEKDAY_MODEL', settings.claudeWeekdayModel);
    if (settings.claudeSundayModel !== undefined) updateOrAppend('CLAUDE_SUNDAY_MODEL', settings.claudeSundayModel);
    if (settings.opencodeWeekdayModel !== undefined) updateOrAppend('OPENCODE_WEEKDAY_MODEL', settings.opencodeWeekdayModel);
    if (settings.opencodeSundayModel !== undefined) updateOrAppend('OPENCODE_SUNDAY_MODEL', settings.opencodeSundayModel);
    if (settings.maxOpenPrs !== undefined) updateOrAppend('MAX_OPEN_PRS', settings.maxOpenPrs);
    if (settings.testCommand !== undefined) updateOrAppend('TEST_COMMAND', settings.testCommand);
    if (settings.personaRotation !== undefined) updateOrAppend('PERSONA_ROTATION', settings.personaRotation);

    fs.writeFileSync(this.configPath, content, 'utf-8');
  }

  public addRepo(spec: string): void {
    const content = fs.readFileSync(this.configPath, 'utf-8');
    const parsed = this.parseRepoSpec(spec);

    // Check if already present
    const current = this.getConfig();
    if (current.repos.some(r => r.path === parsed.path)) {
      return; // Already exists
    }

    // Add inside REPOS=( ... )
    const updated = content.replace(/(REPOS=\([\s\S]*?)(\n\))/, `$1  "${spec}"$2`);
    fs.writeFileSync(this.configPath, updated, 'utf-8');
  }

  public removeRepo(repoPath: string): void {
    const content = fs.readFileSync(this.configPath, 'utf-8');
    const current = this.getConfig();
    const target = current.repos.find(r => r.path === repoPath || r.raw === repoPath);
    if (!target) return;

    // Filter out the line matching target.raw
    const lines = content.split('\n');
    const newLines = lines.filter(l => !l.includes(`"${target.raw}"`) && !l.includes(`'${target.raw}'`));
    fs.writeFileSync(this.configPath, newLines.join('\n'), 'utf-8');
  }

  public updateRepo(oldSpec: string, newSpec: string): void {
    const content = fs.readFileSync(this.configPath, 'utf-8');
    const updated = content.replace(`"${oldSpec}"`, `"${newSpec}"`).replace(`'${oldSpec}'`, `'${newSpec}'`);
    fs.writeFileSync(this.configPath, updated, 'utf-8');
  }
}


import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export interface LogFileInfo {
  date: string;
  repoName: string;
  filePath: string;
  sizeBytes: number;
  lastModified: string;
}

export interface PersonaInfo {
  dayName: string;
  dayNumber: number;
  category: string;
  icon: string;
  description: string;
}

export class LogService {
  private baseLogDir: string;

  constructor() {
    this.baseLogDir = path.join(process.env.HOME || '', 'logs', 'nightly-sweep');
  }

  public getAvailableLogs(repoName?: string): LogFileInfo[] {
    if (!fs.existsSync(this.baseLogDir)) {
      return [];
    }

    const results: LogFileInfo[] = [];
    const dateDirs = fs.readdirSync(this.baseLogDir).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));

    // Sort descending by date
    dateDirs.sort().reverse();

    for (const date of dateDirs) {
      const datePath = path.join(this.baseLogDir, date);
      if (!fs.statSync(datePath).isDirectory()) continue;

      const files = fs.readdirSync(datePath).filter(f => f.endsWith('.log'));
      for (const file of files) {
        const fileRepoName = file.replace(/\.log$/, '');
        if (repoName && fileRepoName !== repoName) continue;

        const filePath = path.join(datePath, file);
        const stat = fs.statSync(filePath);

        results.push({
          date,
          repoName: fileRepoName,
          filePath,
          sizeBytes: stat.size,
          lastModified: stat.mtime.toISOString(),
        });
      }
    }

    return results;
  }

  public readLogFile(filePath: string): string {
    if (!fs.existsSync(filePath)) {
      return 'Log file not found.';
    }
    return fs.readFileSync(filePath, 'utf-8');
  }

  public getTodayPersona(): PersonaInfo {
    const dayNumber = new Date().getDay(); // 0 = Sunday, 1 = Monday, ...
    // Map to ISO day: 1 = Mon ... 7 = Sun
    const isoDay = dayNumber === 0 ? 7 : dayNumber;

    switch (isoDay) {
      case 1:
        return {
          dayName: 'Monday',
          dayNumber: 1,
          category: 'Performance',
          icon: '⚡',
          description: 'N+1 queries, unindexed queries, CPU/memory bottlenecks, and caching.',
        };
      case 2:
        return {
          dayName: 'Tuesday',
          dayNumber: 2,
          category: 'Security',
          icon: '🔒',
          description: 'Auth checks, input sanitization, injection risks, and broken access controls.',
        };
      case 3:
        return {
          dayName: 'Wednesday',
          dayNumber: 3,
          category: 'Testing & Reliability',
          icon: '🧪',
          description: 'Critical coverage gaps, edge cases, and deterministic regression testing.',
        };
      case 4:
        return {
          dayName: 'Thursday',
          dayNumber: 4,
          category: 'Code Health',
          icon: '🩺',
          description: 'Cyclomatic complexity, DRY refactoring, naming, and domain architecture.',
        };
      case 5:
        return {
          dayName: 'Friday',
          dayNumber: 5,
          category: 'Cleanup & Dead Code',
          icon: '🧹',
          description: 'Pruning dead functions, obsolete flags, and unused imports.',
        };
      case 6:
        return {
          dayName: 'Saturday',
          dayNumber: 6,
          category: 'Edge Cases & Hardening',
          icon: '🧪',
          description: 'Stress testing, boundary guards, race conditions, and error schema validation.',
        };
      case 7:
      default:
        return {
          dayName: 'Sunday',
          dayNumber: 7,
          category: 'Deep Architectural Audit',
          icon: '🛡️',
          description: 'Holistic multi-file audit paired with deep reasoning models (Gemini 4 Argon).',
        };
    }
  }

  public async getScheduleStatus(): Promise<{ isScheduled: boolean; type: string; details: string }> {
    const platform = process.platform;
    if (platform === 'darwin') {
      try {
        const { stdout } = await execAsync('launchctl list | grep com.nightly.sweep || true');
        const isLoaded = stdout.includes('com.nightly.sweep');
        return {
          isScheduled: isLoaded,
          type: 'macOS LaunchAgent',
          details: isLoaded ? 'Loaded (Runs at 02:00 AM daily)' : 'Not loaded in launchctl',
        };
      } catch {
        return { isScheduled: false, type: 'macOS LaunchAgent', details: 'Check failed' };
      }
    } else if (platform === 'linux') {
      try {
        const { stdout } = await execAsync('systemctl --user is-active nightly-sweep.timer 2>/dev/null || true');
        const isActive = stdout.trim() === 'active';
        return {
          isScheduled: isActive,
          type: 'Linux systemd timer',
          details: isActive ? 'Active (02:00 AM daily)' : 'Inactive / cron fallback',
        };
      } catch {
        return { isScheduled: false, type: 'Linux systemd timer', details: 'Check failed' };
      }
    }
    return {
      isScheduled: false,
      type: 'Windows Task Scheduler',
      details: 'Manual execution or Windows Task',
    };
  }
}

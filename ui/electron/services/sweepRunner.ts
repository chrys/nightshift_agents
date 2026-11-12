import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface SweepRunOptions {
  repoSpec?: string;
  rootDir: string;
  onData: (chunk: string) => void;
  onExit: (code: number | null) => void;
}

export interface TaskRunOptions {
  taskId: string;
  rootDir: string;
  onData: (chunk: string) => void;
  onExit: (code: number | null) => void;
}

export class SweepRunner {
  private activeProcess: ChildProcess | null = null;

  public isRunning(): boolean {
    return this.activeProcess !== null;
  }

  public runSweep(options: SweepRunOptions): boolean {
    if (this.isRunning()) {
      return false;
    }

    const scriptPath = path.resolve(options.rootDir, 'bin', 'nightly_sweep.sh');
    if (!fs.existsSync(scriptPath)) {
      options.onData(`[Error] Sweep script not found at: ${scriptPath}\n`);
      options.onExit(1);
      return false;
    }

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.HOME}/.local/bin:${process.env.HOME}/.gemini/bin:${process.env.PATH}`,
    };

    let tempConfigFile: string | null = null;

    if (options.repoSpec) {
      // Create isolated single-repo sweep config
      const originalConfig = path.resolve(options.rootDir, 'repos.conf');
      let baseContent = '';
      if (fs.existsSync(originalConfig)) {
        baseContent = fs.readFileSync(originalConfig, 'utf-8');
      }

      // Replace REPOS array with just the single repo spec
      const singleRepoConfig = baseContent.replace(
        /REPOS=\([\s\S]*?\n\)/,
        `REPOS=(\n  "${options.repoSpec}"\n)`
      );

      tempConfigFile = path.join('/tmp', `nightly-single-${Date.now()}.conf`);
      try {
        fs.writeFileSync(tempConfigFile, singleRepoConfig, 'utf-8');
        env.NIGHTLY_CONFIG = tempConfigFile;
      } catch (err) {
        options.onData(`[Warning] Failed to write temporary config; running with default config.\n`);
      }
    }

    // Cross-platform command selection
    let shellExecutable = '/bin/bash';
    const shellArgs = [scriptPath];

    if (process.platform === 'win32') {
      const gitBashPaths = [
        'C:\\Program Files\\Git\\bin\\bash.exe',
        'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Programs\\Git\\bin\\bash.exe'),
      ];
      const foundGitBash = gitBashPaths.find(p => fs.existsSync(p));
      if (foundGitBash) {
        shellExecutable = foundGitBash;
      } else {
        // Fallback to wsl or bash in PATH
        shellExecutable = 'bash';
      }
    }

    options.onData(`[Launcher] Starting nightly sweep...\n`);
    options.onData(`[Launcher] Command: ${shellExecutable} ${scriptPath}\n`);
    if (options.repoSpec) {
      options.onData(`[Launcher] Target Single Repo: ${options.repoSpec}\n`);
    }
    options.onData(`=================================================================\n`);

    this.activeProcess = spawn(shellExecutable, shellArgs, {
      env,
      cwd: options.rootDir,
    });

    this.activeProcess.stdout?.on('data', (data) => {
      options.onData(data.toString());
    });

    this.activeProcess.stderr?.on('data', (data) => {
      options.onData(data.toString());
    });

    this.activeProcess.on('close', (code) => {
      this.activeProcess = null;
      if (tempConfigFile && fs.existsSync(tempConfigFile)) {
        try { fs.unlinkSync(tempConfigFile); } catch {}
      }
      options.onData(`\n=================================================================\n`);
      options.onData(`[Launcher] Sweep finished with exit code ${code}\n`);
      options.onExit(code);
    });

    this.activeProcess.on('error', (err) => {
      this.activeProcess = null;
      if (tempConfigFile && fs.existsSync(tempConfigFile)) {
        try { fs.unlinkSync(tempConfigFile); } catch {}
      }
      options.onData(`\n[Launcher Error] Failed to execute sweep process: ${err.message}\n`);
      options.onExit(1);
    });

    return true;
  }

  public runTask(options: TaskRunOptions): boolean {
    if (this.isRunning()) {
      return false;
    }

    const scriptPath = path.resolve(options.rootDir, 'bin', 'run_task.sh');
    if (!fs.existsSync(scriptPath)) {
      options.onData(`[Error] Task runner script not found at: ${scriptPath}\n`);
      options.onExit(1);
      return false;
    }

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.HOME}/.local/bin:${process.env.HOME}/.gemini/bin:${process.env.PATH}`,
    };

    let shellExecutable = '/bin/bash';
    const shellArgs = [scriptPath, options.taskId];

    if (process.platform === 'win32') {
      const gitBashPaths = [
        'C:\\Program Files\\Git\\bin\\bash.exe',
        'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Programs\\Git\\bin\\bash.exe'),
      ];
      const foundGitBash = gitBashPaths.find(p => fs.existsSync(p));
      if (foundGitBash) {
        shellExecutable = foundGitBash;
      } else {
        shellExecutable = 'bash';
      }
    }

    options.onData(`[Launcher] Starting one-time task: ${options.taskId}...\n`);
    options.onData(`[Launcher] Command: ${shellExecutable} ${scriptPath} ${options.taskId}\n`);
    options.onData(`=================================================================\n`);

    this.activeProcess = spawn(shellExecutable, shellArgs, {
      env,
      cwd: options.rootDir,
    });

    this.activeProcess.stdout?.on('data', (data) => {
      options.onData(data.toString());
    });

    this.activeProcess.stderr?.on('data', (data) => {
      options.onData(data.toString());
    });

    this.activeProcess.on('close', (code) => {
      this.activeProcess = null;
      options.onData(`\n=================================================================\n`);
      options.onData(`[Launcher] Task execution finished with exit code ${code}\n`);
      options.onExit(code);
    });

    this.activeProcess.on('error', (err) => {
      this.activeProcess = null;
      options.onData(`\n[Launcher Error] Failed to execute task runner: ${err.message}\n`);
      options.onExit(1);
    });

    return true;
  }

  public stopSweep(): boolean {
    if (this.activeProcess) {
      this.activeProcess.kill('SIGINT');
      setTimeout(() => {
        if (this.activeProcess) {
          this.activeProcess.kill('SIGKILL');
        }
      }, 3000);
      return true;
    }
    return false;
  }
}


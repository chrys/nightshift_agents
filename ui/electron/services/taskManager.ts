import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import util from 'util';

const execFileAsync = util.promisify(execFile);

export interface TaskItem {
  id: string;
  repoPath: string;
  repoName: string;
  prompt: string;
  scheduleDate: string; // YYYY-MM-DD
  timingOption: 'tonight' | 'tomorrow' | 'custom' | 'now';
  model: string;
  engine: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  prNumber?: number;
  prUrl?: string;
  prTitle?: string;
  prState?: 'OPEN' | 'MERGED' | 'CLOSED';
  failureReason?: string;
  logPath?: string;
  createdAt: string;
  completedAt?: string;
}

export class TaskManager {
  private tasksFilePath: string;

  constructor(rootDir: string) {
    const tasksDir = path.resolve(rootDir, 'tasks');
    if (!fs.existsSync(tasksDir)) {
      fs.mkdirSync(tasksDir, { recursive: true });
    }
    this.tasksFilePath = path.join(tasksDir, 'tasks.json');
    if (!fs.existsSync(this.tasksFilePath)) {
      fs.writeFileSync(this.tasksFilePath, '[]', 'utf-8');
    }
  }

  private readAll(): TaskItem[] {
    try {
      if (!fs.existsSync(this.tasksFilePath)) return [];
      const content = fs.readFileSync(this.tasksFilePath, 'utf-8');
      return JSON.parse(content) || [];
    } catch {
      return [];
    }
  }

  private saveAll(tasks: TaskItem[]): void {
    fs.writeFileSync(this.tasksFilePath, JSON.stringify(tasks, null, 2), 'utf-8');
  }

  public async getTasks(repoPath?: string): Promise<TaskItem[]> {
    const tasks = this.readAll();
    const filtered = repoPath ? tasks.filter((t) => t.repoPath === repoPath) : tasks;

    // Refresh PR status for any task with a prNumber
    for (const task of filtered) {
      if (task.prNumber && task.repoPath && (!task.prState || task.prState === 'OPEN')) {
        try {
          const { stdout } = await execFileAsync(
            'gh',
            ['pr', 'view', task.prNumber.toString(), '--json', 'state,mergedAt'],
            {
              cwd: task.repoPath,
              env: {
                ...process.env,
                PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.HOME}/.local/bin:${process.env.HOME}/.gemini/bin:${process.env.PATH}`,
              },
            }
          );
          if (stdout) {
            const data = JSON.parse(stdout);
            const isMerged = !!data.mergedAt;
            task.prState = isMerged ? 'MERGED' : (data.state === 'OPEN' ? 'OPEN' : 'CLOSED');
          }
        } catch {
          // ignore offline or private repo errors
        }
      }
    }

    // Save updated states
    this.saveAll(tasks);

    // Sort descending by creation date
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public createTask(data: Omit<TaskItem, 'id' | 'createdAt' | 'status'>): TaskItem {
    const tasks = this.readAll();
    const id = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newTask: TaskItem = {
      ...data,
      id,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    tasks.push(newTask);
    this.saveAll(tasks);
    return newTask;
  }

  public updateTask(id: string, updates: Partial<TaskItem>): TaskItem | null {
    const tasks = this.readAll();
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) return null;

    tasks[index] = { ...tasks[index], ...updates };
    this.saveAll(tasks);
    return tasks[index];
  }

  public deleteTask(id: string): boolean {
    const tasks = this.readAll();
    const filtered = tasks.filter((t) => t.id !== id);
    if (filtered.length !== tasks.length) {
      this.saveAll(filtered);
      return true;
    }
    return false;
  }

  public getTaskById(id: string): TaskItem | null {
    const tasks = this.readAll();
    return tasks.find((t) => t.id === id) || null;
  }
}


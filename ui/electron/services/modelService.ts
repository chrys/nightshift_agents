import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export interface ModelOption {
  id: string;
  label: string;
}

export const DEFAULT_AGY_MODELS: ModelOption[] = [
  { id: 'gemini-4-argon-medium', label: 'Gemini 4 Argon (Medium)' },
  { id: 'gemini-4-argon-high', label: 'Gemini 4 Argon (High)' },
  { id: 'gemini-4-argon-low', label: 'Gemini 4 Argon (Low)' },
  { id: 'gemini-3.8-flash-high', label: 'Gemini 3.8 Flash (High)' },
  { id: 'gemini-3.8-flash-medium', label: 'Gemini 3.8 Flash (Medium)' },
  { id: 'gemini-3.8-flash-low', label: 'Gemini 3.8 Flash (Low)' },
  { id: 'claude-opus-5-5-low', label: 'Claude Opus 5.5 (Low)' },
  { id: 'claude-opus-5-5-medium', label: 'Claude Opus 5.5 (Medium)' },
  { id: 'claude-opus-5-5-high', label: 'Claude Opus 5.5 (High)' },
  { id: 'claude-sonnet-5-5-low', label: 'Claude Sonnet 5.5 (Low)' },
  { id: 'claude-sonnet-5-5-medium', label: 'Claude Sonnet 5.5 (Medium)' },
  { id: 'claude-sonnet-5-5-high', label: 'Claude Sonnet 5.5 (High)' },
  { id: 'gpt-oss-120b-medium', label: 'GPT-OSS 120B (Medium)' },
];

export const DEFAULT_CLAUDE_MODELS: ModelOption[] = [
  { id: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet' },
  { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
  { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
];

export const DEFAULT_OPENCODE_MODELS: ModelOption[] = [
  { id: 'google/gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
  { id: 'google/gemini-4-argon', label: 'Gemini 4 Argon' },
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { id: 'opencode/deepseek-v4.1-flash-free', label: 'DeepSeek v4.1 Flash (Free)' },
  { id: 'opencode/glm-5.3-flash-free', label: 'GLM 5.3 Flash (Free)' },
];

export class ModelService {
  private cache: Record<string, ModelOption[]> = {};

  public async getModelsForEngine(engine: string): Promise<ModelOption[]> {
    if (this.cache[engine] && this.cache[engine].length > 0) {
      return this.cache[engine];
    }

    if (engine === 'agy') {
      try {
        const { stdout } = await execAsync('agy models', {
          timeout: 5000,
          env: {
            ...process.env,
            PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.HOME}/.local/bin:${process.env.HOME}/.gemini/bin:${process.env.PATH}`,
          },
        });
        const clean = stdout
          .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
          .replace(/[\u2800-\u28FF]/g, '');
        const lines = clean.split('\n').map((l) => l.trim()).filter((l) => l && !l.includes('Fetching'));
        const models: ModelOption[] = [];
        for (const line of lines) {
          const parts = line.split('\t');
          if (parts[0]) {
            models.push({
              id: parts[0].trim(),
              label: (parts[1] || parts[0]).trim(),
            });
          }
        }
        if (models.length > 0) {
          this.cache['agy'] = models;
          return models;
        }
      } catch {
        // Fall back to DEFAULT_AGY_MODELS
      }
      return DEFAULT_AGY_MODELS;
    }

    if (engine === 'opencode') {
      try {
        const { stdout } = await execAsync('opencode models', {
          timeout: 5000,
          env: {
            ...process.env,
            PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.HOME}/.local/bin:${process.env.HOME}/.gemini/bin:${process.env.PATH}`,
          },
        });
        const lines = stdout.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length > 0) {
          const models = lines.map((l) => ({ id: l, label: l }));
          this.cache['opencode'] = models;
          return models;
        }
      } catch {
        // Fall back
      }
      return DEFAULT_OPENCODE_MODELS;
    }

    if (engine === 'claude') {
      return DEFAULT_CLAUDE_MODELS;
    }

    return DEFAULT_AGY_MODELS;
  }
}

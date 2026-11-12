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

export interface ScheduleStatus {
  isScheduled: boolean;
  type: string;
  details: string;
}

export interface ModelOption {
  id: string;
  label: string;
}

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

export interface ElectronAPI {
  getConfig: () => Promise<ConfigData>;
  updateGlobalConfig: (settings: Partial<ConfigData>) => Promise<ConfigData>;
  addRepo: (spec: string) => Promise<ConfigData>;
  removeRepo: (repoPath: string) => Promise<ConfigData>;
  updateRepo: (oldSpec: string, newSpec: string) => Promise<ConfigData>;
  openDirectoryDialog: () => Promise<string | null>;

  getRepoGitDetails: (repoPath: string) => Promise<{
    currentBranch: string;
    remotes: string[];
    localBranches: string[];
  }>;
  getPullRequests: (repoPath: string) => Promise<{
    open: PullRequestItem[];
    merged: PullRequestItem[];
    declined: PullRequestItem[];
  }>;

  getIgnoreFile: (repoPath: string) => Promise<IgnoreFileContent>;
  saveIgnoreFile: (repoPath: string, content: string) => Promise<boolean>;
  getPromptFile: (repoPath: string) => Promise<{ content: string; isCustom: boolean }>;
  savePromptFile: (repoPath: string, content: string) => Promise<boolean>;
  deleteCustomPromptFile: (repoPath: string) => Promise<boolean>;

  getAvailableLogs: (repoName?: string) => Promise<LogFileInfo[]>;
  readLogFile: (filePath: string) => Promise<string>;
  getTodayPersona: () => Promise<PersonaInfo>;
  getScheduleStatus: () => Promise<ScheduleStatus>;

  runSweep: (repoSpec?: string) => Promise<boolean>;
  stopSweep: () => Promise<boolean>;
  openExternal: (url: string) => Promise<void>;

  getTasks: (repoPath?: string) => Promise<TaskItem[]>;
  createTask: (data: Omit<TaskItem, 'id' | 'createdAt' | 'status'>) => Promise<TaskItem>;
  deleteTask: (id: string) => Promise<boolean>;
  runTask: (taskId: string) => Promise<boolean>;
  getEngineModels: (engine: string) => Promise<ModelOption[]>;

  onSweepOutput: (callback: (chunk: string) => void) => () => void;
  onSweepComplete: (callback: (code: number | null) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}


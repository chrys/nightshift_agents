import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  // Config management
  getConfig: () => ipcRenderer.invoke('config:get'),
  updateGlobalConfig: (settings: any) => ipcRenderer.invoke('config:updateGlobal', settings),
  addRepo: (spec: string) => ipcRenderer.invoke('config:addRepo', spec),
  removeRepo: (repoPath: string) => ipcRenderer.invoke('config:removeRepo', repoPath),
  updateRepo: (oldSpec: string, newSpec: string) => ipcRenderer.invoke('config:updateRepo', oldSpec, newSpec),
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory'),

  // Git and GitHub
  getRepoGitDetails: (repoPath: string) => ipcRenderer.invoke('git:getDetails', repoPath),
  getPullRequests: (repoPath: string) => ipcRenderer.invoke('git:getPullRequests', repoPath),

  // Ignore and Prompt files
  getIgnoreFile: (repoPath: string) => ipcRenderer.invoke('git:getIgnoreFile', repoPath),
  saveIgnoreFile: (repoPath: string, content: string) => ipcRenderer.invoke('git:saveIgnoreFile', repoPath, content),
  getPromptFile: (repoPath: string) => ipcRenderer.invoke('git:getPromptFile', repoPath),
  savePromptFile: (repoPath: string, content: string) => ipcRenderer.invoke('git:savePromptFile', repoPath, content),
  deleteCustomPromptFile: (repoPath: string) => ipcRenderer.invoke('git:deleteCustomPrompt', repoPath),

  // Logs and Scheduling
  getAvailableLogs: (repoName?: string) => ipcRenderer.invoke('log:getAvailable', repoName),
  readLogFile: (filePath: string) => ipcRenderer.invoke('log:readFile', filePath),
  getTodayPersona: () => ipcRenderer.invoke('log:getPersona'),
  getScheduleStatus: () => ipcRenderer.invoke('log:getScheduleStatus'),

  // Sweep Execution
  runSweep: (repoSpec?: string) => ipcRenderer.invoke('sweep:run', repoSpec),
  stopSweep: () => ipcRenderer.invoke('sweep:stop'),

  // One-time Tasks
  getTasks: (repoPath?: string) => ipcRenderer.invoke('tasks:get', repoPath),
  createTask: (data: any) => ipcRenderer.invoke('tasks:create', data),
  deleteTask: (id: string) => ipcRenderer.invoke('tasks:delete', id),
  runTask: (taskId: string) => ipcRenderer.invoke('tasks:run', taskId),

  // Utilities
  openExternal: (url: string) => ipcRenderer.invoke('util:openExternal', url),

  // Events
  onSweepOutput: (callback: (chunk: string) => void) => {
    const subscription = (_event: any, value: string) => callback(value);
    ipcRenderer.on('sweep:output', subscription);
    return () => ipcRenderer.removeListener('sweep:output', subscription);
  },
  onSweepComplete: (callback: (code: number | null) => void) => {
    const subscription = (_event: any, code: number | null) => callback(code);
    ipcRenderer.on('sweep:complete', subscription);
    return () => ipcRenderer.removeListener('sweep:complete', subscription);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);


import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { ConfigManager } from './services/configManager';
import { GitService } from './services/gitService';
import { LogService } from './services/logService';
import { SweepRunner } from './services/sweepRunner';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const rootDir = path.resolve(__dirname, '..', '..');

const configManager = new ConfigManager(rootDir);
const gitService = new GitService();
const logService = new LogService();
const sweepRunner = new SweepRunner();

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1050,
    minHeight: 650,
    backgroundColor: '#0d1117',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    title: 'Nightly Prompts Cockpit',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ----------------------------------------------------------------------------
// IPC Handlers
// ----------------------------------------------------------------------------

// Dialog
ipcMain.handle('dialog:openDirectory', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Git Repository',
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

// Config
ipcMain.handle('config:get', async () => {
  return configManager.getConfig();
});

ipcMain.handle('config:addRepo', async (_event, spec: string) => {
  configManager.addRepo(spec);
  return configManager.getConfig();
});

ipcMain.handle('config:removeRepo', async (_event, repoPath: string) => {
  configManager.removeRepo(repoPath);
  return configManager.getConfig();
});

ipcMain.handle('config:updateRepo', async (_event, oldSpec: string, newSpec: string) => {
  configManager.updateRepo(oldSpec, newSpec);
  return configManager.getConfig();
});

// Git
ipcMain.handle('git:getDetails', async (_event, repoPath: string) => {
  return gitService.getRepoGitDetails(repoPath);
});

ipcMain.handle('git:getPullRequests', async (_event, repoPath: string) => {
  return gitService.getPullRequests(repoPath);
});

ipcMain.handle('git:getIgnoreFile', async (_event, repoPath: string) => {
  return gitService.getIgnoreFile(repoPath);
});

ipcMain.handle('git:saveIgnoreFile', async (_event, repoPath: string, content: string) => {
  gitService.saveIgnoreFile(repoPath, content);
  return true;
});

ipcMain.handle('git:getPromptFile', async (_event, repoPath: string) => {
  return gitService.getPromptFile(repoPath, rootDir);
});

ipcMain.handle('git:savePromptFile', async (_event, repoPath: string, content: string) => {
  gitService.savePromptFile(repoPath, content);
  return true;
});

ipcMain.handle('git:deleteCustomPrompt', async (_event, repoPath: string) => {
  gitService.deleteCustomPromptFile(repoPath);
  return true;
});

// Logs & Scheduling
ipcMain.handle('log:getAvailable', async (_event, repoName?: string) => {
  return logService.getAvailableLogs(repoName);
});

ipcMain.handle('log:readFile', async (_event, filePath: string) => {
  return logService.readLogFile(filePath);
});

ipcMain.handle('log:getPersona', async () => {
  return logService.getTodayPersona();
});

ipcMain.handle('log:getScheduleStatus', async () => {
  return logService.getScheduleStatus();
});

// Sweep Execution
ipcMain.handle('sweep:run', async (_event, repoSpec?: string) => {
  return sweepRunner.runSweep({
    repoSpec,
    rootDir,
    onData: (chunk: string) => {
      mainWindow?.webContents.send('sweep:output', chunk);
    },
    onExit: (code: number | null) => {
      mainWindow?.webContents.send('sweep:complete', code);
    },
  });
});

ipcMain.handle('sweep:stop', async () => {
  return sweepRunner.stopSweep();
});

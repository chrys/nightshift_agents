import './styles.css';
import { ConfigData, PersonaInfo, RepoSpec, ScheduleStatus } from './types/electron';
import { renderSidebar } from './components/sidebar';
import { renderPrOverview } from './components/prOverview';
import { renderRulesEditor } from './components/rulesEditor';
import { renderLogViewer, appendLiveLogChunk } from './components/logViewer';
import { renderProjectSettings } from './components/projectSettings';

class AppController {
  private config: ConfigData | null = null;
  private selectedRepo: RepoSpec | null = null;
  private activeTab: 'overview' | 'rules' | 'logs' | 'settings' = 'overview';
  private persona: PersonaInfo | null = null;
  private schedule: ScheduleStatus | null = null;

  private isSweepRunning = false;
  private liveLogs = '';

  constructor() {
    this.init();
  }

  private async init() {
    this.setupEventListeners();
    await this.refreshGlobalData();

    if (this.config && this.config.repos.length > 0) {
      this.selectProject(this.config.repos[0]);
    } else {
      this.renderEmptyState();
    }
  }

  private async refreshGlobalData() {
    try {
      this.config = await window.electronAPI.getConfig();
      this.persona = await window.electronAPI.getTodayPersona();
      this.schedule = await window.electronAPI.getScheduleStatus();
      this.renderSidebarView();
    } catch (err) {
      console.error('Failed to load global data:', err);
    }
  }

  private renderSidebarView() {
    if (!this.config) return;
    renderSidebar(
      this.config.repos,
      this.selectedRepo,
      this.persona,
      this.schedule,
      {
        onSelectProject: (repo) => this.selectProject(repo),
        onRemoveProject: (repo) => this.removeProject(repo),
        onOpenAddModal: () => this.openAddModal(),
      }
    );
  }

  public async selectProject(repo: RepoSpec) {
    this.selectedRepo = repo;
    this.renderSidebarView();
    this.updateProjectHeader();
    await this.renderActiveTab();
  }

  private updateProjectHeader() {
    const nameEl = document.getElementById('current-project-name');
    const pathEl = document.getElementById('current-project-path');
    const engineEl = document.getElementById('current-project-engine');
    const branchEl = document.getElementById('current-project-branch');

    if (!this.selectedRepo) {
      if (nameEl) nameEl.innerText = 'No Project Selected';
      if (pathEl) pathEl.innerText = '';
      return;
    }

    if (nameEl) nameEl.innerText = this.selectedRepo.name;
    if (pathEl) pathEl.innerText = this.selectedRepo.path;
    if (engineEl) engineEl.innerText = this.selectedRepo.engine || this.config?.engine || 'agy';
    if (branchEl) branchEl.innerText = this.selectedRepo.branch || 'main';
  }

  private async renderActiveTab() {
    const container = document.getElementById('tab-content');
    if (!container || !this.selectedRepo) return;

    container.innerHTML = '<div class="text-center py-12 text-dark-500 text-xs">Loading tab data...</div>';

    switch (this.activeTab) {
      case 'overview': {
        const prs = await window.electronAPI.getPullRequests(this.selectedRepo.path);
        renderPrOverview(container, this.selectedRepo, prs);
        break;
      }
      case 'rules': {
        const ignoreData = await window.electronAPI.getIgnoreFile(this.selectedRepo.path);
        renderRulesEditor(container, this.selectedRepo, ignoreData, async (newContent) => {
          await window.electronAPI.saveIgnoreFile(this.selectedRepo!.path, newContent);
        });
        break;
      }
      case 'logs': {
        const availableLogs = await window.electronAPI.getAvailableLogs(this.selectedRepo.name);
        renderLogViewer(
          container,
          this.selectedRepo,
          availableLogs,
          this.liveLogs,
          this.isSweepRunning,
          async (filePath) => window.electronAPI.readLogFile(filePath)
        );
        break;
      }
      case 'settings': {
        const gitDetails = await window.electronAPI.getRepoGitDetails(this.selectedRepo.path);
        const promptData = await window.electronAPI.getPromptFile(this.selectedRepo.path);
        renderProjectSettings(
          container,
          this.selectedRepo,
          this.config!,
          gitDetails,
          promptData,
          async (globalSettings) => {
            this.config = await window.electronAPI.updateGlobalConfig(globalSettings);
            await this.refreshGlobalData();
          },
          async (newSpec) => {
            await window.electronAPI.updateRepo(this.selectedRepo!.raw, newSpec);
            await this.refreshGlobalData();
            const updated = this.config?.repos.find((r) => r.path === this.selectedRepo?.path);
            if (updated) this.selectProject(updated);
          },
          async (content) => {
            await window.electronAPI.savePromptFile(this.selectedRepo!.path, content);
            await this.renderActiveTab();
          },
          async () => {
            await window.electronAPI.deleteCustomPromptFile(this.selectedRepo!.path);
            await this.renderActiveTab();
          }
        );
        break;
      }
    }
  }

  private renderEmptyState() {
    const container = document.getElementById('tab-content');
    if (container) {
      container.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center text-center p-8 text-dark-500 space-y-3">
          <span class="text-4xl">📂</span>
          <h3 class="text-base font-semibold text-white">No Projects Configured</h3>
          <p class="text-xs max-w-sm">Add a local Git repository to start inspecting PR history, architectural rules, and executing sweeps.</p>
          <button id="btn-empty-state-add" class="px-4 py-2 bg-brand-500 hover:bg-brand-600 rounded-md text-xs font-semibold text-white transition-colors">
            Add Your First Repository
          </button>
        </div>
      `;
      document.getElementById('btn-empty-state-add')?.addEventListener('click', () => this.openAddModal());
    }
  }

  private setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.cockpit-tab').forEach((el) => {
      el.addEventListener('click', () => {
        const targetTab = (el as HTMLElement).dataset.tab as any;
        if (!targetTab) return;
        this.activeTab = targetTab;

        document.querySelectorAll('.cockpit-tab').forEach((tab) => {
          tab.classList.remove('border-brand-500', 'text-white');
          tab.classList.add('border-transparent', 'text-dark-500');
        });
        el.classList.remove('border-transparent', 'text-dark-500');
        el.classList.add('border-brand-500', 'text-white');

        this.renderActiveTab();
      });
    });

    // Run Single Repo Sweep
    const btnRunSingle = document.getElementById('btn-run-single');
    btnRunSingle?.addEventListener('click', () => {
      if (this.isSweepRunning) {
        this.stopSweep();
      } else if (this.selectedRepo) {
        this.runSweep(this.selectedRepo.raw);
      }
    });

    // Run All Repos Sweep
    const btnRunAll = document.getElementById('btn-run-all');
    btnRunAll?.addEventListener('click', () => {
      if (this.isSweepRunning) {
        this.stopSweep();
      } else {
        this.runSweep();
      }
    });

    // Add Project Modal Controls
    document.getElementById('btn-add-project')?.addEventListener('click', () => this.openAddModal());
    document.getElementById('btn-close-modal')?.addEventListener('click', () => this.closeAddModal());
    document.getElementById('btn-cancel-add')?.addEventListener('click', () => this.closeAddModal());

    document.getElementById('btn-browse-folder')?.addEventListener('click', async () => {
      const selected = await window.electronAPI.openDirectoryDialog();
      if (selected) {
        const input = document.getElementById('input-repo-path') as HTMLInputElement;
        if (input) input.value = selected;
      }
    });

    document.getElementById('btn-confirm-add')?.addEventListener('click', async () => {
      const pathInput = (document.getElementById('input-repo-path') as HTMLInputElement).value.trim();
      const branchInput = (document.getElementById('input-repo-branch') as HTMLInputElement).value.trim();
      const engineSelect = (document.getElementById('select-repo-engine') as HTMLSelectElement).value;

      if (!pathInput) {
        alert('Please enter or select a repository path.');
        return;
      }

      let spec = pathInput;
      if (branchInput && engineSelect) {
        spec = `${pathInput}:${branchInput}:${engineSelect}`;
      } else if (branchInput) {
        spec = `${pathInput}:${branchInput}`;
      } else if (engineSelect) {
        spec = `${pathInput}:${engineSelect}`;
      }

      await window.electronAPI.addRepo(spec);
      this.closeAddModal();
      await this.refreshGlobalData();

      const newRepo = this.config?.repos.find((r) => r.path === pathInput);
      if (newRepo) this.selectProject(newRepo);
    });

    // IPC Sweep Streaming
    window.electronAPI.onSweepOutput((chunk) => {
      this.liveLogs += chunk;
      appendLiveLogChunk(chunk);
    });

    window.electronAPI.onSweepComplete((code) => {
      this.isSweepRunning = false;
      this.updateRunButtonsState();
      // Auto refresh PR view after sweep completes
      if (this.activeTab === 'overview') {
        this.renderActiveTab();
      }
    });
  }

  private async runSweep(repoSpec?: string) {
    this.isSweepRunning = true;
    this.liveLogs = '';
    this.updateRunButtonsState();

    // Switch to Logs Tab so user sees live output
    const logsTabButton = document.querySelector('[data-tab="logs"]') as HTMLButtonElement;
    if (logsTabButton) logsTabButton.click();

    await window.electronAPI.runSweep(repoSpec);
  }

  private async stopSweep() {
    await window.electronAPI.stopSweep();
  }

  private updateRunButtonsState() {
    const btnSingleText = document.getElementById('btn-run-single-text');
    const btnSingle = document.getElementById('btn-run-single');
    const btnAll = document.getElementById('btn-run-all');

    if (this.isSweepRunning) {
      if (btnSingleText) btnSingleText.innerText = 'Stop Sweep';
      btnSingle?.classList.remove('bg-brand-500', 'hover:bg-brand-600');
      btnSingle?.classList.add('bg-red-600', 'hover:bg-red-700');

      if (btnAll) {
        btnAll.innerHTML = '<span>⏹️</span><span>Stop Sweep</span>';
        btnAll.classList.remove('bg-brand-500', 'hover:bg-brand-600');
        btnAll.classList.add('bg-red-600', 'hover:bg-red-700');
      }
    } else {
      if (btnSingleText) btnSingleText.innerText = 'Run Sweep Now';
      btnSingle?.classList.remove('bg-red-600', 'hover:bg-red-700');
      btnSingle?.classList.add('bg-brand-500', 'hover:bg-brand-600');

      if (btnAll) {
        btnAll.innerHTML = '<span>⚡</span><span>Run All Repos</span>';
        btnAll.classList.remove('bg-red-600', 'hover:bg-red-700');
        btnAll.classList.add('bg-brand-500', 'hover:bg-brand-600');
      }
    }
  }

  private async removeProject(repo: RepoSpec) {
    await window.electronAPI.removeRepo(repo.path);
    await this.refreshGlobalData();

    if (this.selectedRepo?.path === repo.path) {
      if (this.config && this.config.repos.length > 0) {
        this.selectProject(this.config.repos[0]);
      } else {
        this.selectedRepo = null;
        this.updateProjectHeader();
        this.renderEmptyState();
      }
    }
  }

  private openAddModal() {
    const modal = document.getElementById('modal-add-project');
    const pathInput = document.getElementById('input-repo-path') as HTMLInputElement;
    const branchInput = document.getElementById('input-repo-branch') as HTMLInputElement;
    const engineSelect = document.getElementById('select-repo-engine') as HTMLSelectElement;

    if (pathInput) pathInput.value = '';
    if (branchInput) branchInput.value = '';
    if (engineSelect) engineSelect.value = '';

    modal?.classList.remove('hidden');
  }

  private closeAddModal() {
    const modal = document.getElementById('modal-add-project');
    modal?.classList.add('hidden');
  }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new AppController();
});


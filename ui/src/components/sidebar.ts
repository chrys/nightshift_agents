import { RepoSpec, PersonaInfo, ScheduleStatus } from '../types/electron';

export interface SidebarCallbacks {
  onSelectProject: (repo: RepoSpec) => void;
  onRemoveProject: (repo: RepoSpec) => void;
  onOpenAddModal: () => void;
}

export function renderSidebar(
  repos: RepoSpec[],
  selectedRepo: RepoSpec | null,
  persona: PersonaInfo | null,
  schedule: ScheduleStatus | null,
  callbacks: SidebarCallbacks
) {
  const container = document.getElementById('project-list');
  if (!container) return;

  if (repos.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 px-4 text-xs text-dark-500">
        <p>No repositories configured yet.</p>
        <button id="btn-empty-add" class="mt-3 text-brand-500 hover:underline">Add your first project</button>
      </div>
    `;
    document.getElementById('btn-empty-add')?.addEventListener('click', callbacks.onOpenAddModal);
    return;
  }

  container.innerHTML = repos
    .map((repo) => {
      const isSelected = selectedRepo?.path === repo.path;
      return `
        <div 
          class="project-item group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
            isSelected ? 'bg-dark-700 text-white font-medium border border-dark-600' : 'hover:bg-dark-700/50 text-dark-100'
          }"
          data-path="${repo.path}"
        >
          <div class="flex-1 min-w-0 pr-2">
            <div class="flex items-center space-x-2">
              <span class="truncate text-xs font-semibold">${repo.name}</span>
              ${
                repo.branch
                  ? `<span class="px-1.5 py-0.2 text-[10px] rounded bg-dark-600 text-blue-400 font-mono">${repo.branch}</span>`
                  : ''
              }
              ${
                repo.engine
                  ? `<span class="px-1.5 py-0.2 text-[10px] rounded bg-dark-600 text-purple-400">${repo.engine}</span>`
                  : ''
              }
            </div>
            <p class="text-[11px] text-dark-500 truncate font-mono mt-0.5">${repo.path}</p>
          </div>
          
          <button 
            class="btn-delete-repo opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-dark-500 transition-opacity" 
            title="Remove from Nightly Prompts"
            data-path="${repo.path}"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </div>
      `;
    })
    .join('');

  // Attach selection listeners
  container.querySelectorAll('.project-item').forEach((el) => {
    el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.btn-delete-repo')) return;
      const targetPath = (el as HTMLElement).dataset.path;
      const found = repos.find((r) => r.path === targetPath);
      if (found) callbacks.onSelectProject(found);
    });
  });

  // Attach delete listeners
  container.querySelectorAll('.btn-delete-repo').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetPath = (el as HTMLElement).dataset.path;
      const found = repos.find((r) => r.path === targetPath);
      if (found && confirm(`Remove "${found.name}" from nightly sweeps? (No files will be deleted)`)) {
        callbacks.onRemoveProject(found);
      }
    });
  });

  // Update schedule status card
  const scheduleContainer = document.getElementById('schedule-card');
  if (scheduleContainer && schedule) {
    scheduleContainer.innerHTML = `
      <div class="flex items-center justify-between mb-1.5">
        <span class="font-medium text-dark-100 flex items-center space-x-1.5">
          <span class="w-2 h-2 rounded-full ${schedule.isScheduled ? 'bg-green-500' : 'bg-yellow-500'}"></span>
          <span>${schedule.type}</span>
        </span>
        <span class="text-[10px] text-dark-500 font-mono">02:00 AM</span>
      </div>
      <p class="text-[11px] text-dark-500">${schedule.details}</p>
    `;
  }

  // Update persona badge in top header
  const personaBadge = document.getElementById('persona-badge');
  if (personaBadge && persona) {
    personaBadge.innerHTML = `
      <span class="mr-1">${persona.icon}</span>
      <span>Tonight: ${persona.dayName} (${persona.category})</span>
    `;
    personaBadge.title = persona.description;
  }
}

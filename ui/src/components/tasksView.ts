import { ModelOption, RepoSpec, TaskItem } from '../types/electron';

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

const ALL_KNOWN_MODELS: Record<string, string> = {
  'gemini-4-argon-medium': 'Gemini 4 Argon (Medium)',
  'gemini-4-argon-high': 'Gemini 4 Argon (High)',
  'gemini-4-argon-low': 'Gemini 4 Argon (Low)',
  'gemini-3.8-flash-high': 'Gemini 3.8 Flash (High)',
  'gemini-3.8-flash-medium': 'Gemini 3.8 Flash (Medium)',
  'gemini-3.8-flash-low': 'Gemini 3.8 Flash (Low)',
  'claude-opus-5-5-low': 'Claude Opus 5.5 (Low)',
  'claude-opus-5-5-medium': 'Claude Opus 5.5 (Medium)',
  'claude-opus-5-5-high': 'Claude Opus 5.5 (High)',
  'claude-sonnet-5-5-low': 'Claude Sonnet 5.5 (Low)',
  'claude-sonnet-5-5-medium': 'Claude Sonnet 5.5 (Medium)',
  'claude-sonnet-5-5-high': 'Claude Sonnet 5.5 (High)',
  'gpt-oss-120b-medium': 'GPT-OSS 120B (Medium)',
  'claude-3-7-sonnet-20250219': 'Claude 3.7 Sonnet',
  'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
  'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
  'claude-3-opus-20240229': 'Claude 3 Opus',
  'google/gemini-3.8-flash': 'Gemini 3.8 Flash',
  'google/gemini-4-argon': 'Gemini 4 Argon',
  'google/gemini-2.5-flash': 'Gemini 2.5 Flash',
  'google/gemini-2.5-pro': 'Gemini 2.5 Pro',
};

function getModelDisplayLabel(modelId: string): string {
  if (!modelId) return 'Default';
  return ALL_KNOWN_MODELS[modelId] || modelId;
}

export function renderTasksView(
  container: HTMLElement,
  currentRepo: RepoSpec,
  tasks: TaskItem[],
  callbacks: {
    onCreateTask: (data: Omit<TaskItem, 'id' | 'createdAt' | 'status'>, runImmediately: boolean) => Promise<void>;
    onRunTask: (taskId: string) => Promise<void>;
    onDeleteTask: (taskId: string) => Promise<void>;
    onViewLog?: (logPath: string) => void;
  }
) {
  const repoTasks = tasks.filter((t) => t.repoPath === currentRepo.path);
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const initialEngine = currentRepo.engine || 'agy';

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Composer Card -->
      <div class="bg-dark-800 border border-dark-600 rounded-xl p-5 space-y-4 shadow-sm">
        <div class="flex items-center justify-between border-b border-dark-600 pb-3">
          <div>
            <h3 class="text-sm font-semibold text-white flex items-center space-x-2">
              <span>📝</span>
              <span>Schedule One-Time Task</span>
            </h3>
            <p class="text-xs text-dark-400 mt-0.5">
              Queue a targeted one-off instruction for <strong>${currentRepo.name}</strong> to run during the nightly sweep or immediately.
            </p>
          </div>
          <span class="text-xs px-2.5 py-1 rounded bg-dark-700 border border-dark-600 text-brand-400 font-mono">
            ${currentRepo.name}
          </span>
        </div>

        <!-- Prompt Textarea -->
        <div>
          <label class="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-1.5">
            Task Instructions / Prompt
          </label>
          <textarea
            id="task-prompt-input"
            rows="4"
            placeholder="E.g., Refactor RoomController to use RoomService, ensure capacity validations are added with edge case tests, and verify tests pass."
            class="w-full bg-dark-900 border border-dark-600 rounded-lg p-3 text-xs text-white placeholder-dark-500 font-sans focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 leading-relaxed"
          ></textarea>
        </div>

        <!-- Controls Grid: Engine -> Model -> Schedule -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <!-- Engine Selector -->
          <div>
            <label class="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-1.5">
              AI Engine
            </label>
            <select
              id="task-engine-select"
              class="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
            >
              <option value="agy" ${initialEngine === 'agy' ? 'selected' : ''}>Google Antigravity (agy)</option>
              <option value="claude" ${initialEngine === 'claude' ? 'selected' : ''}>Claude Code (claude)</option>
              <option value="opencode" ${initialEngine === 'opencode' ? 'selected' : ''}>OpenCode (opencode)</option>
            </select>
          </div>

          <!-- Model Choice (Dynamically Updated According to Engine) -->
          <div>
            <label class="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>AI Model</span>
              <span id="model-loading-indicator" class="hidden text-[10px] text-brand-400 font-normal">Loading...</span>
            </label>
            <select
              id="task-model-select"
              class="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
            >
              <!-- Injected dynamically based on engine -->
            </select>

            <div id="task-custom-model-container" class="hidden mt-2">
              <input
                type="text"
                id="task-custom-model"
                placeholder="Enter custom model identifier"
                class="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
          </div>

          <!-- Timing Option -->
          <div>
            <label class="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-1.5">
              When to Run
            </label>
            <select
              id="task-timing-select"
              class="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
            >
              <option value="tonight" selected>Tonight (Scheduled Sweep)</option>
              <option value="tomorrow">Tomorrow Night (${tomorrowStr})</option>
              <option value="custom">Custom Date...</option>
              <option value="now">⚡ Run Right Now</option>
            </select>

            <div id="task-custom-date-container" class="hidden mt-2">
              <input
                type="date"
                id="task-custom-date"
                value="${todayStr}"
                min="${todayStr}"
                class="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center justify-end space-x-3 pt-3 border-t border-dark-600">
          <button
            id="btn-schedule-task"
            class="flex items-center space-x-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
          >
            <span>📅</span>
            <span id="btn-schedule-text">Schedule for Tonight</span>
          </button>
          <button
            id="btn-run-task-now"
            class="flex items-center space-x-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
          >
            <span>⚡</span>
            <span>Run Right Now</span>
          </button>
        </div>
      </div>

      <!-- Previous One-Time Tasks Card & Table -->
      <div class="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden shadow-sm">
        <div class="p-4 border-b border-dark-600 flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <h3 class="text-sm font-semibold text-white flex items-center space-x-2">
              <span>📋</span>
              <span>Task History & Outcomes</span>
            </h3>
            <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-dark-700 text-dark-300 border border-dark-600">
              ${repoTasks.length} task${repoTasks.length === 1 ? '' : 's'}
            </span>
          </div>
          <span class="text-xs text-dark-500">Auto-refreshes PR status</span>
        </div>

        ${repoTasks.length === 0 ? `
          <div class="p-12 text-center text-dark-500 space-y-2">
            <div class="text-3xl">📭</div>
            <p class="text-xs">No one-time tasks scheduled for this project yet.</p>
            <p class="text-xs text-dark-600">Write an instruction above to schedule your first nightly one-off task.</p>
          </div>
        ` : `
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-dark-300">
              <thead class="bg-dark-900 border-b border-dark-600 text-dark-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th class="px-4 py-3">Schedule / Date</th>
                  <th class="px-4 py-3">Prompt</th>
                  <th class="px-4 py-3">Engine & Model</th>
                  <th class="px-4 py-3">Status</th>
                  <th class="px-4 py-3">Result / PR</th>
                  <th class="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-dark-600">
                ${repoTasks.map((task) => renderTaskRow(task)).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>
  `;

  // Model & Engine dynamic wiring
  const engineSelect = container.querySelector('#task-engine-select') as HTMLSelectElement;
  const modelSelect = container.querySelector('#task-model-select') as HTMLSelectElement;
  const customModelContainer = container.querySelector('#task-custom-model-container') as HTMLElement;
  const customModelInput = container.querySelector('#task-custom-model') as HTMLInputElement;
  const loadingIndicator = container.querySelector('#model-loading-indicator') as HTMLElement;

  const updateModelsForEngine = async (engine: string) => {
    loadingIndicator?.classList.remove('hidden');

    let models: ModelOption[] = [];
    try {
      if (window.electronAPI.getEngineModels) {
        models = await window.electronAPI.getEngineModels(engine);
      }
    } catch {
      // fallback
    }

    if (!models || models.length === 0) {
      if (engine === 'agy') models = DEFAULT_AGY_MODELS;
      else if (engine === 'claude') models = DEFAULT_CLAUDE_MODELS;
      else if (engine === 'opencode') models = DEFAULT_OPENCODE_MODELS;
      else models = DEFAULT_AGY_MODELS;
    }

    loadingIndicator?.classList.add('hidden');

    let html = '';
    for (const m of models) {
      const isSelected = (engine === 'agy' && m.id === 'gemini-3.8-flash-high') || false;
      html += `<option value="${escapeHtml(m.id)}" ${isSelected ? 'selected' : ''}>${escapeHtml(m.label)}</option>`;
    }
    html += `<option value="custom">Custom Model Name...</option>`;

    modelSelect.innerHTML = html;
    customModelContainer?.classList.add('hidden');
    if (customModelInput) customModelInput.value = '';
  };

  // Initial populate of models
  updateModelsForEngine(engineSelect.value);

  // Engine change listener
  engineSelect.addEventListener('change', () => {
    updateModelsForEngine(engineSelect.value);
  });

  // Model select change listener
  modelSelect.addEventListener('change', () => {
    if (modelSelect.value === 'custom') {
      customModelContainer?.classList.remove('hidden');
    } else {
      customModelContainer?.classList.add('hidden');
    }
  });

  // Timing select toggle
  const timingSelect = container.querySelector('#task-timing-select') as HTMLSelectElement;
  const customDateContainer = container.querySelector('#task-custom-date-container') as HTMLElement;
  const scheduleBtnText = container.querySelector('#btn-schedule-text') as HTMLElement;

  timingSelect?.addEventListener('change', () => {
    const val = timingSelect.value;
    if (val === 'custom') {
      customDateContainer?.classList.remove('hidden');
      if (scheduleBtnText) scheduleBtnText.innerText = 'Schedule Task';
    } else {
      customDateContainer?.classList.add('hidden');
      if (val === 'tonight') {
        if (scheduleBtnText) scheduleBtnText.innerText = 'Schedule for Tonight';
      } else if (val === 'tomorrow') {
        if (scheduleBtnText) scheduleBtnText.innerText = 'Schedule for Tomorrow';
      } else if (val === 'now') {
        if (scheduleBtnText) scheduleBtnText.innerText = 'Queue for Immediate Run';
      }
    }
  });

  // Helper to gather task form data
  const getFormData = (): Omit<TaskItem, 'id' | 'createdAt' | 'status'> | null => {
    const promptInput = container.querySelector('#task-prompt-input') as HTMLTextAreaElement;
    const prompt = promptInput?.value.trim();
    if (!prompt) {
      alert('Please enter task instructions / prompt.');
      return null;
    }

    const timingOption = timingSelect.value as 'tonight' | 'tomorrow' | 'custom' | 'now';
    let scheduleDate = todayStr;
    if (timingOption === 'tomorrow') {
      scheduleDate = tomorrowStr;
    } else if (timingOption === 'custom') {
      const customDateInput = container.querySelector('#task-custom-date') as HTMLInputElement;
      scheduleDate = customDateInput?.value || todayStr;
    }

    let model = modelSelect.value;
    if (model === 'custom') {
      model = customModelInput?.value.trim() || 'gemini-3.8-flash-high';
    }

    const engine = engineSelect.value || 'agy';

    return {
      repoPath: currentRepo.path,
      repoName: currentRepo.name,
      prompt,
      scheduleDate,
      timingOption,
      model,
      engine,
    };
  };

  // Schedule button handler
  container.querySelector('#btn-schedule-task')?.addEventListener('click', async () => {
    const data = getFormData();
    if (!data) return;
    const runImmediately = data.timingOption === 'now';
    await callbacks.onCreateTask(data, runImmediately);
  });

  // Run Right Now button handler
  container.querySelector('#btn-run-task-now')?.addEventListener('click', async () => {
    const data = getFormData();
    if (!data) return;
    data.timingOption = 'now';
    await callbacks.onCreateTask(data, true);
  });

  // Row action handlers
  container.querySelectorAll('.btn-run-existing-task').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const taskId = (btn as HTMLElement).dataset.taskId;
      if (taskId) {
        await callbacks.onRunTask(taskId);
      }
    });
  });

  container.querySelectorAll('.btn-delete-task').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const taskId = (btn as HTMLElement).dataset.taskId;
      if (taskId && confirm('Are you sure you want to delete this task?')) {
        await callbacks.onDeleteTask(taskId);
      }
    });
  });

  container.querySelectorAll('.task-pr-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const url = (link as HTMLElement).dataset.url;
      if (url) {
        window.electronAPI.openExternal(url);
      }
    });
  });
}

function renderTaskRow(task: TaskItem): string {
  // Format timing badge
  let timingLabel = task.scheduleDate;
  if (task.timingOption === 'tonight') timingLabel = `Tonight (${task.scheduleDate})`;
  else if (task.timingOption === 'tomorrow') timingLabel = `Tomorrow (${task.scheduleDate})`;
  else if (task.timingOption === 'now') timingLabel = `Immediate`;

  // Status badge
  let statusBadge = '';
  switch (task.status) {
    case 'pending':
      statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">⏳ Pending</span>`;
      break;
    case 'running':
      statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">⚙️ Running...</span>`;
      break;
    case 'completed':
      statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">✅ Completed</span>`;
      break;
    case 'failed':
      statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20" title="${escapeHtml(task.failureReason || 'Failed')}">❌ Failed</span>`;
      break;
    default:
      statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-dark-700 text-dark-400 border border-dark-600">${task.status}</span>`;
  }

  // PR Link / Outcome badge
  let resultCell = `<span class="text-dark-500 italic">None</span>`;
  if (task.prUrl) {
    let prStateBadge = '';
    if (task.prState === 'MERGED') {
      prStateBadge = `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">MERGED</span>`;
    } else if (task.prState === 'CLOSED') {
      prStateBadge = `<span class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-dark-700 text-dark-400 border border-dark-600">CLOSED</span>`;
    } else {
      prStateBadge = `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">OPEN</span>`;
    }

    resultCell = `
      <div class="flex items-center space-x-2">
        <a href="#" data-url="${task.prUrl}" class="task-pr-link font-medium text-brand-400 hover:text-brand-300 hover:underline flex items-center space-x-1">
          <span>PR #${task.prNumber || ''}</span>
          <span class="text-[10px]">↗</span>
        </a>
        ${prStateBadge}
      </div>
    `;
  } else if (task.status === 'failed' && task.failureReason) {
    resultCell = `
      <div class="text-rose-400 font-mono text-[11px] truncate max-w-xs" title="${escapeHtml(task.failureReason)}">
        ${escapeHtml(task.failureReason)}
      </div>
    `;
  } else if (task.status === 'completed' && !task.prUrl) {
    resultCell = `<span class="text-dark-400 italic">No diff / code changes needed</span>`;
  }

  const modelLabel = getModelDisplayLabel(task.model);

  return `
    <tr class="hover:bg-dark-700/50 transition-colors">
      <td class="px-4 py-3 font-mono text-[11px] whitespace-nowrap text-dark-300">
        ${timingLabel}
      </td>
      <td class="px-4 py-3 max-w-xs">
        <div class="font-medium text-dark-200 truncate" title="${escapeHtml(task.prompt)}">
          ${escapeHtml(task.prompt)}
        </div>
      </td>
      <td class="px-4 py-3 whitespace-nowrap">
        <div class="flex items-center space-x-1.5">
          <span class="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-dark-700 text-dark-400 border border-dark-600">
            ${task.engine || 'agy'}
          </span>
          <span class="px-2 py-0.5 rounded text-[11px] font-medium bg-dark-700 text-dark-200 border border-dark-600" title="${escapeHtml(task.model)}">
            ${escapeHtml(modelLabel)}
          </span>
        </div>
      </td>
      <td class="px-4 py-3 whitespace-nowrap">
        ${statusBadge}
      </td>
      <td class="px-4 py-3 whitespace-nowrap">
        ${resultCell}
      </td>
      <td class="px-4 py-3 text-right whitespace-nowrap space-x-2">
        ${task.status !== 'running' ? `
          <button
            data-task-id="${task.id}"
            class="btn-run-existing-task px-2 py-1 rounded bg-dark-700 hover:bg-dark-600 text-white text-[11px] font-medium transition-colors"
            title="Run this task now"
          >
            ⚡ Run Now
          </button>
        ` : ''}
        <button
          data-task-id="${task.id}"
          class="btn-delete-task px-2 py-1 rounded bg-dark-700 hover:bg-rose-900/60 text-dark-400 hover:text-rose-300 text-[11px] font-medium transition-colors"
          title="Delete task"
        >
          🗑️
        </button>
      </td>
    </tr>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

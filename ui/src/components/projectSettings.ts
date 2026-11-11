import { ConfigData, RepoSpec } from '../types/electron';

export function renderProjectSettings(
  container: HTMLElement,
  repo: RepoSpec,
  config: ConfigData,
  gitDetails: { currentBranch: string; remotes: string[]; localBranches: string[] },
  promptData: { content: string; isCustom: boolean },
  onSaveGlobalConfig: (settings: Partial<ConfigData>) => Promise<void>,
  onSaveRepoConfig: (newSpec: string) => Promise<void>,
  onSavePrompt: (content: string) => Promise<void>,
  onResetPrompt: () => Promise<void>
) {
  const currentBranch = repo.branch || gitDetails.currentBranch || 'main';
  const currentEngine = repo.engine || '';

  const weekdayModelPresets = [
    'Gemini 3.8 Flash (High)',
    'Gemini 3.8 Flash (Medium)',
    'Gemini 3.8 Flash (Low)',
    'Gemini 3.5 Pro (High)',
    'claude-3-7-sonnet-20250219',
    'claude-3-5-sonnet-20241022',
  ];

  const sundayModelPresets = [
    'Gemini 4 Argon (Medium)',
    'Gemini 4 Argon (High)',
    'Gemini 3.5 Pro (High)',
    'claude-3-opus-20240229',
  ];

  const currentWeekdayModel = config.agyWeekdayModel || 'Gemini 3.8 Flash (High)';
  const currentSundayModel = config.agySundayModel || 'Gemini 4 Argon (Medium)';

  container.innerHTML = `
    <div class="space-y-8 max-w-4xl pb-10">
      <!-- Section 1: Global AI Engine & Model Settings -->
      <div class="bg-dark-800 border border-dark-600 rounded-xl p-6 space-y-5 shadow-sm">
        <div class="flex items-center justify-between border-b border-dark-700 pb-3">
          <div>
            <h3 class="text-sm font-bold text-white flex items-center space-x-2">
              <span>🤖</span>
              <span>Global AI Engine & Model Configuration</span>
            </h3>
            <p class="text-xs text-dark-500 mt-0.5">Controls which AI CLI and models are used across scheduled sweeps (saved to <code class="text-blue-400 font-mono text-[11px]">repos.conf</code>).</p>
          </div>
          <span id="global-save-status" class="text-xs text-green-400 font-medium hidden">✓ Global configuration saved!</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
          <!-- Engine -->
          <div>
            <label class="block font-semibold text-dark-50 mb-1.5">Default AI Engine</label>
            <select id="global-engine" class="w-full bg-dark-900 border border-dark-600 rounded-md px-3 py-2 text-white font-medium focus:outline-none focus:border-brand-500">
              <option value="agy" ${config.engine === 'agy' ? 'selected' : ''}>Google Antigravity (agy)</option>
              <option value="claude" ${config.engine === 'claude' ? 'selected' : ''}>Claude Code (claude)</option>
              <option value="opencode" ${config.engine === 'opencode' ? 'selected' : ''}>OpenCode (opencode)</option>
            </select>
            <p class="text-[11px] text-dark-500 mt-1">Default CLI used when a repo has no override.</p>
          </div>

          <!-- Weekday Model -->
          <div>
            <label class="block font-semibold text-dark-50 mb-1.5 flex items-center justify-between">
              <span>Weekday Model (Mon–Sat)</span>
              <span class="text-[10px] text-dark-500 font-normal">Fast / High-Quota</span>
            </label>
            <div class="space-y-1.5">
              <input 
                type="text" 
                id="global-weekday-model" 
                value="${escapeHtml(currentWeekdayModel)}" 
                placeholder="e.g. Gemini 3.8 Flash (High)"
                class="w-full bg-dark-900 border border-dark-600 rounded-md px-3 py-1.5 text-white font-mono focus:outline-none focus:border-brand-500 text-xs"
              />
              <select id="preset-weekday-model" class="w-full bg-dark-700 border border-dark-600 rounded px-2 py-1 text-[11px] text-dark-100">
                <option value="">-- Choose preset model --</option>
                ${weekdayModelPresets
                  .map(
                    (m) =>
                      `<option value="${escapeHtml(m)}" ${
                        m === currentWeekdayModel ? 'selected' : ''
                      }>${escapeHtml(m)}</option>`
                  )
                  .join('')}
              </select>
            </div>
            <p class="text-[11px] text-dark-500 mt-1">Used during daily weekday sweeps.</p>
          </div>

          <!-- Sunday Deep Reasoning Model -->
          <div>
            <label class="block font-semibold text-dark-50 mb-1.5 flex items-center justify-between">
              <span>Sunday Model (Deep Audit)</span>
              <span class="text-[10px] text-purple-400 font-normal">Deep Reasoning</span>
            </label>
            <div class="space-y-1.5">
              <input 
                type="text" 
                id="global-sunday-model" 
                value="${escapeHtml(currentSundayModel)}" 
                placeholder="e.g. Gemini 4 Argon (Medium)"
                class="w-full bg-dark-900 border border-dark-600 rounded-md px-3 py-1.5 text-white font-mono focus:outline-none focus:border-brand-500 text-xs"
              />
              <select id="preset-sunday-model" class="w-full bg-dark-700 border border-dark-600 rounded px-2 py-1 text-[11px] text-dark-100">
                <option value="">-- Choose preset model --</option>
                ${sundayModelPresets
                  .map(
                    (m) =>
                      `<option value="${escapeHtml(m)}" ${
                        m === currentSundayModel ? 'selected' : ''
                      }>${escapeHtml(m)}</option>`
                  )
                  .join('')}
              </select>
            </div>
            <p class="text-[11px] text-dark-500 mt-1">Used on Sundays for deep architecture sweeps.</p>
          </div>
        </div>

        <!-- Quality & Review Controls -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-5 pt-3 border-t border-dark-700 text-xs">
          <div>
            <label class="block font-semibold text-dark-50 mb-1.5">PR Backlog Throttle (MAX_OPEN_PRS)</label>
            <input 
              type="number" 
              id="global-max-prs" 
              value="${config.maxOpenPrs}" 
              min="0"
              max="50"
              class="w-full bg-dark-900 border border-dark-600 rounded-md px-3 py-2 text-white font-mono focus:outline-none focus:border-brand-500"
            />
            <p class="text-[11px] text-dark-500 mt-1">Pauses new sweeps if N unmerged PRs are awaiting review (0 to disable).</p>
          </div>

          <div>
            <label class="block font-semibold text-dark-50 mb-1.5">Verification Test Command (Optional)</label>
            <input 
              type="text" 
              id="global-test-cmd" 
              value="${escapeHtml(config.testCommand || '')}" 
              placeholder="e.g. uv run pytest -q or npm test"
              class="w-full bg-dark-900 border border-dark-600 rounded-md px-3 py-2 text-white font-mono focus:outline-none focus:border-brand-500"
            />
            <p class="text-[11px] text-dark-500 mt-1">Pre-push gate: failing tests discard the branch before opening a PR.</p>
          </div>

          <div>
            <label class="block font-semibold text-dark-50 mb-1.5">Daily Persona Rotation</label>
            <div class="flex items-center space-x-2 pt-2">
              <input 
                type="checkbox" 
                id="global-persona-rotation" 
                ${config.personaRotation ? 'checked' : ''} 
                class="w-4 h-4 rounded bg-dark-900 border-dark-600 text-brand-500 focus:ring-0"
              />
              <span class="text-xs text-dark-100 font-medium">Rotate theme daily (Perf, Sec, Test, etc.)</span>
            </div>
            <p class="text-[11px] text-dark-500 mt-1">Prevents the agent from fixating on a single category every night.</p>
          </div>
        </div>

        <div class="flex justify-end pt-2">
          <button id="btn-save-global-config" class="px-5 py-2 rounded-md text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white transition-colors shadow">
            Save Global Configuration
          </button>
        </div>
      </div>

      <!-- Section 2: Selected Project Target & Branch Settings -->
      <div class="bg-dark-800 border border-dark-600 rounded-xl p-6 space-y-4 shadow-sm">
        <div class="flex items-center justify-between border-b border-dark-700 pb-3">
          <div>
            <h3 class="text-sm font-bold text-white flex items-center space-x-2">
              <span>🎯</span>
              <span>Project Target Branch & Engine: <span class="text-brand-500">${escapeHtml(repo.name)}</span></span>
            </h3>
            <p class="text-xs text-dark-500 mt-0.5">Configure target base branch and optional per-repository engine overrides.</p>
          </div>
          <span id="project-save-status" class="text-xs text-green-400 font-medium hidden">✓ Project target updated!</span>
        </div>

        <div class="grid grid-cols-2 gap-4 text-xs">
          <div>
            <label class="block font-semibold text-dark-50 mb-1.5">Target Base Branch</label>
            <input 
              type="text" 
              id="setting-branch" 
              value="${escapeHtml(currentBranch)}" 
              placeholder="e.g. main or develop"
              class="w-full bg-dark-900 border border-dark-600 rounded-md px-3 py-2 text-white font-mono focus:outline-none focus:border-brand-500"
            />
            <p class="text-[11px] text-dark-500 mt-1">Destination branch for pull requests (e.g. <code class="text-blue-400 font-mono">main</code> or <code class="text-blue-400 font-mono">develop</code>).</p>
          </div>

          <div>
            <label class="block font-semibold text-dark-50 mb-1.5">AI Engine Override for This Project</label>
            <select 
              id="setting-engine" 
              class="w-full bg-dark-900 border border-dark-600 rounded-md px-3 py-2 text-white focus:outline-none focus:border-brand-500 font-medium"
            >
              <option value="" ${!currentEngine ? 'selected' : ''}>Use Global Default (${config.engine})</option>
              <option value="agy" ${currentEngine === 'agy' ? 'selected' : ''}>Antigravity (agy)</option>
              <option value="claude" ${currentEngine === 'claude' ? 'selected' : ''}>Claude Code (claude)</option>
              <option value="opencode" ${currentEngine === 'opencode' ? 'selected' : ''}>OpenCode (opencode)</option>
            </select>
            <p class="text-[11px] text-dark-500 mt-1">Override the global AI engine specifically for this repository.</p>
          </div>
        </div>

        <div class="flex justify-end pt-2">
          <button id="btn-save-project-config" class="px-5 py-2 rounded-md text-xs font-semibold bg-dark-700 hover:bg-dark-600 text-white transition-colors border border-dark-600">
            Update Project Target
          </button>
        </div>
      </div>

      <!-- Section 3: Custom Agent Prompt -->
      <div class="bg-dark-800 border border-dark-600 rounded-xl p-6 space-y-4 shadow-sm">
        <div class="flex items-center justify-between border-b border-dark-700 pb-3">
          <div>
            <h3 class="text-sm font-bold text-white flex items-center space-x-2">
              <span>📝</span>
              <span>Project Sweep Prompt</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-medium ${
                promptData.isCustom
                  ? 'bg-purple-950 text-purple-300 border border-purple-800'
                  : 'bg-dark-700 text-dark-100 border border-dark-600'
              }">
                ${promptData.isCustom ? 'Custom (.agents/nightly_prompt.md)' : 'Global Template'}
              </span>
            </h3>
            <p class="text-xs text-dark-500 mt-0.5">
              ${
                promptData.isCustom
                  ? 'Using repository-specific prompt.'
                  : 'Inheriting global template with daily persona rotation.'
              }
            </p>
          </div>

          <div class="flex items-center space-x-2">
            ${
              promptData.isCustom
                ? `<button id="btn-reset-prompt" class="px-3 py-1.5 rounded-md text-xs font-medium bg-dark-700 hover:bg-dark-600 text-dark-100 transition-colors border border-dark-600">
                    Reset to Global Template
                   </button>`
                : ''
            }
            <button id="btn-save-prompt" class="px-4 py-1.5 rounded-md text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white transition-colors">
              Save Prompt
            </button>
          </div>
        </div>

        <textarea 
          id="prompt-editor" 
          rows="14" 
          class="w-full bg-dark-900 border border-dark-600 rounded-lg p-4 font-mono text-xs text-dark-100 focus:outline-none focus:border-brand-500 leading-relaxed resize-y shadow-inner"
        >${escapeHtml(promptData.content)}</textarea>
      </div>
    </div>
  `;

  // --- Handlers: Model Presets Synchronizer ---
  const inputWeekdayModel = document.getElementById('global-weekday-model') as HTMLInputElement;
  const selectPresetWeekday = document.getElementById('preset-weekday-model') as HTMLSelectElement;
  selectPresetWeekday?.addEventListener('change', () => {
    if (selectPresetWeekday.value) {
      inputWeekdayModel.value = selectPresetWeekday.value;
    }
  });

  const inputSundayModel = document.getElementById('global-sunday-model') as HTMLInputElement;
  const selectPresetSunday = document.getElementById('preset-sunday-model') as HTMLSelectElement;
  selectPresetSunday?.addEventListener('change', () => {
    if (selectPresetSunday.value) {
      inputSundayModel.value = selectPresetSunday.value;
    }
  });

  // --- Handlers: Save Global Config ---
  const btnSaveGlobal = document.getElementById('btn-save-global-config');
  btnSaveGlobal?.addEventListener('click', async () => {
    const engine = (document.getElementById('global-engine') as HTMLSelectElement).value;
    const weekdayModel = inputWeekdayModel.value.trim();
    const sundayModel = inputSundayModel.value.trim();
    const maxPrs = parseInt((document.getElementById('global-max-prs') as HTMLInputElement).value, 10) || 3;
    const testCmd = (document.getElementById('global-test-cmd') as HTMLInputElement).value.trim();
    const personaRotation = (document.getElementById('global-persona-rotation') as HTMLInputElement).checked;

    const statusEl = document.getElementById('global-save-status');
    btnSaveGlobal.innerText = 'Saving...';

    await onSaveGlobalConfig({
      engine,
      agyWeekdayModel: weekdayModel,
      agySundayModel: sundayModel,
      maxOpenPrs: maxPrs,
      testCommand: testCmd,
      personaRotation,
    });

    btnSaveGlobal.innerText = 'Save Global Configuration';
    if (statusEl) {
      statusEl.classList.remove('hidden');
      setTimeout(() => statusEl.classList.add('hidden'), 2500);
    }
  });

  // --- Handlers: Save Project Target ---
  const btnSaveRepo = document.getElementById('btn-save-project-config');
  const inputBranch = document.getElementById('setting-branch') as HTMLInputElement;
  const selectEngine = document.getElementById('setting-engine') as HTMLSelectElement;

  btnSaveRepo?.addEventListener('click', async () => {
    const branch = inputBranch.value.trim();
    const engine = selectEngine.value;

    let newSpec = repo.path;
    if (branch && engine) {
      newSpec = `${repo.path}:${branch}:${engine}`;
    } else if (branch) {
      newSpec = `${repo.path}:${branch}`;
    } else if (engine) {
      newSpec = `${repo.path}:${engine}`;
    }

    const statusEl = document.getElementById('project-save-status');
    btnSaveRepo.innerText = 'Updating...';
    await onSaveRepoConfig(newSpec);
    btnSaveRepo.innerText = 'Update Project Target';
    if (statusEl) {
      statusEl.classList.remove('hidden');
      setTimeout(() => statusEl.classList.add('hidden'), 2500);
    }
  });

  // --- Handlers: Save & Reset Prompt ---
  const btnSavePrompt = document.getElementById('btn-save-prompt');
  const btnResetPrompt = document.getElementById('btn-reset-prompt');
  const promptEditor = document.getElementById('prompt-editor') as HTMLTextAreaElement;

  btnSavePrompt?.addEventListener('click', async () => {
    if (!promptEditor) return;
    btnSavePrompt.innerText = 'Saving...';
    await onSavePrompt(promptEditor.value);
    btnSavePrompt.innerText = 'Save Prompt';
  });

  btnResetPrompt?.addEventListener('click', async () => {
    if (confirm('Delete custom prompt and revert to global template?')) {
      await onResetPrompt();
    }
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

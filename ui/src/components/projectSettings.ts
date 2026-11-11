import { RepoSpec } from '../types/electron';

export function renderProjectSettings(
  container: HTMLElement,
  repo: RepoSpec,
  gitDetails: { currentBranch: string; remotes: string[]; localBranches: string[] },
  promptData: { content: string; isCustom: boolean },
  onSaveConfig: (newSpec: string) => Promise<void>,
  onSavePrompt: (content: string) => Promise<void>,
  onResetPrompt: () => Promise<void>
) {
  const currentBranch = repo.branch || gitDetails.currentBranch || 'main';
  const currentEngine = repo.engine || '';

  container.innerHTML = `
    <div class="space-y-6 max-w-4xl">
      <!-- Section: Project Configuration -->
      <div class="bg-dark-800 border border-dark-600 rounded-xl p-5 space-y-4">
        <h3 class="text-sm font-semibold text-white">Project Pipeline Configuration</h3>

        <div class="grid grid-cols-2 gap-4 text-xs">
          <div>
            <label class="block font-medium text-dark-50 mb-1">Target Base Branch</label>
            <input 
              type="text" 
              id="setting-branch" 
              value="${escapeHtml(currentBranch)}" 
              placeholder="e.g. main or develop"
              class="w-full bg-dark-900 border border-dark-600 rounded-md px-3 py-2 text-white font-mono focus:outline-none focus:border-brand-500"
            />
            <p class="text-[11px] text-dark-500 mt-1">Branch where nightly PRs will target.</p>
          </div>

          <div>
            <label class="block font-medium text-dark-50 mb-1">AI Engine Override</label>
            <select 
              id="setting-engine" 
              class="w-full bg-dark-900 border border-dark-600 rounded-md px-3 py-2 text-white focus:outline-none focus:border-brand-500"
            >
              <option value="" ${!currentEngine ? 'selected' : ''}>Use Global Default</option>
              <option value="agy" ${currentEngine === 'agy' ? 'selected' : ''}>Antigravity (agy)</option>
              <option value="claude" ${currentEngine === 'claude' ? 'selected' : ''}>Claude Code (claude)</option>
              <option value="opencode" ${currentEngine === 'opencode' ? 'selected' : ''}>OpenCode (opencode)</option>
            </select>
            <p class="text-[11px] text-dark-500 mt-1">Leave as default or pin to a specific CLI engine.</p>
          </div>
        </div>

        <div class="pt-2 flex items-center justify-between border-t border-dark-700">
          <span class="text-xs text-dark-500">Updates <code class="text-blue-400 font-mono">repos.conf</code> entry</span>
          <button id="btn-save-project-config" class="px-4 py-1.5 rounded-md text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white transition-colors">
            Update Config
          </button>
        </div>
      </div>

      <!-- Section: Custom Agent Prompt -->
      <div class="bg-dark-800 border border-dark-600 rounded-xl p-5 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-white flex items-center space-x-2">
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
                ? `<button id="btn-reset-prompt" class="px-3 py-1.5 rounded-md text-xs font-medium bg-dark-700 hover:bg-dark-600 text-dark-100 transition-colors">
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
          class="w-full bg-dark-900 border border-dark-600 rounded-lg p-4 font-mono text-xs text-dark-100 focus:outline-none focus:border-brand-500 leading-relaxed resize-y"
        >${escapeHtml(promptData.content)}</textarea>
      </div>
    </div>
  `;

  const btnSaveConfig = document.getElementById('btn-save-project-config');
  const inputBranch = document.getElementById('setting-branch') as HTMLInputElement;
  const selectEngine = document.getElementById('setting-engine') as HTMLSelectElement;

  btnSaveConfig?.addEventListener('click', async () => {
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

    btnSaveConfig.innerText = 'Saving...';
    await onSaveConfig(newSpec);
    btnSaveConfig.innerText = 'Updated!';
    setTimeout(() => (btnSaveConfig.innerText = 'Update Config'), 2000);
  });

  const btnSavePrompt = document.getElementById('btn-save-prompt');
  const btnResetPrompt = document.getElementById('btn-reset-prompt');
  const promptEditor = document.getElementById('prompt-editor') as HTMLTextAreaElement;

  btnSavePrompt?.addEventListener('click', async () => {
    if (!promptEditor) return;
    btnSavePrompt.innerText = 'Saving...';
    await onSavePrompt(promptEditor.value);
    btnSavePrompt.innerText = 'Saved!';
    setTimeout(() => (btnSavePrompt.innerText = 'Save Prompt'), 2000);
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

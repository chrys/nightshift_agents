import { IgnoreFileContent, RepoSpec } from '../types/electron';

export function renderRulesEditor(
  container: HTMLElement,
  repo: RepoSpec,
  ignoreData: IgnoreFileContent,
  onSave: (newContent: string) => Promise<void>
) {
  const { staticRules, architecturalRules, evaluatedPrs, raw } = ignoreData;

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-white">Repository Architectural Rules & Guardrails</h3>
          <p class="text-xs text-dark-500 mt-0.5">Loaded from <code class="text-blue-400 font-mono text-[11px]">${ignoreData.filePath}</code></p>
        </div>
        <button id="btn-save-rules" class="px-4 py-1.5 rounded-md text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white transition-colors shadow">
          Save Rules
        </button>
      </div>

      <!-- Quick Summary Cards -->
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-dark-800 border border-dark-600 p-3.5 rounded-xl">
          <div class="text-xs text-dark-500">Static Guardrails</div>
          <div class="text-xl font-bold text-white mt-1">${staticRules.length}</div>
        </div>
        <div class="bg-dark-800 border border-dark-600 p-3.5 rounded-xl">
          <div class="text-xs text-dark-500">Learned from Rejected PRs</div>
          <div class="text-xl font-bold text-blue-400 mt-1">${architecturalRules.length}</div>
        </div>
        <div class="bg-dark-800 border border-dark-600 p-3.5 rounded-xl">
          <div class="text-xs text-dark-500">Evaluated Clean PRs</div>
          <div class="text-xl font-bold text-green-400 mt-1">${evaluatedPrs.length}</div>
        </div>
      </div>

      <!-- Learned Architectural Rules List -->
      ${
        architecturalRules.length > 0
          ? `
            <div class="space-y-3">
              <h4 class="text-xs font-semibold uppercase tracking-wider text-dark-50 flex items-center space-x-1.5">
                <span>🧠</span>
                <span>Auto-Learned Architectural Exclusions</span>
              </h4>
              <div class="space-y-2">
                ${architecturalRules
                  .map(
                    (rule) => `
                  <div class="bg-dark-800 border border-dark-600 rounded-lg p-3.5 space-y-1.5">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-white">${escapeHtml(rule.title)}</span>
                      <span class="px-2 py-0.5 rounded text-[10px] bg-blue-950 text-blue-300 border border-blue-800">PR #${rule.prNumber}</span>
                    </div>
                    <ul class="text-xs text-dark-100 list-disc list-inside space-y-1">
                      ${rule.rules.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}
                    </ul>
                  </div>
                `
                  )
                  .join('')}
              </div>
            </div>
          `
          : ''
      }

      <!-- Editor Area -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <label class="block text-xs font-semibold text-dark-50 uppercase tracking-wider">
            Edit Raw Rules File (.nightly-ignore.md)
          </label>
          <span id="rules-save-status" class="text-xs text-green-400 hidden">Saved successfully!</span>
        </div>
        <textarea 
          id="rules-raw-editor" 
          rows="14" 
          class="w-full bg-dark-800 border border-dark-600 rounded-lg p-4 font-mono text-xs text-dark-100 focus:outline-none focus:border-brand-500 leading-relaxed resize-y"
        >${escapeHtml(raw || '# Permanent Guardrails\n# Nightly Agent Exclusions & Rules\n- Do NOT touch legacy/\n')}</textarea>
      </div>
    </div>
  `;

  const btnSave = document.getElementById('btn-save-rules');
  const textarea = document.getElementById('rules-raw-editor') as HTMLTextAreaElement;
  const statusSpan = document.getElementById('rules-save-status');

  btnSave?.addEventListener('click', async () => {
    if (!textarea) return;
    btnSave.innerText = 'Saving...';
    await onSave(textarea.value);
    btnSave.innerText = 'Save Rules';
    if (statusSpan) {
      statusSpan.classList.remove('hidden');
      setTimeout(() => statusSpan.classList.add('hidden'), 2500);
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


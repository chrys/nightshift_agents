import { IgnoreFileContent, RepoSpec } from '../types/electron';

type RulesFilterTab = 'learned' | 'static' | 'evaluated' | 'raw';

export function renderRulesEditor(
  container: HTMLElement,
  repo: RepoSpec,
  ignoreData: IgnoreFileContent,
  onSave: (newContent: string) => Promise<void>
) {
  const { staticRules, architecturalRules, evaluatedPrs, raw } = ignoreData;

  // Initial active tab: prioritize learned rules if any, else static guardrails
  let activeTab: RulesFilterTab = architecturalRules.length > 0 ? 'learned' : (staticRules.length > 0 ? 'static' : 'raw');

  function render() {
    container.innerHTML = `
      <div class="space-y-6">
        <!-- Header -->
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-white">Repository Rules & Guardrails</h3>
            <p class="text-xs text-dark-500 mt-0.5">Loaded from <code class="text-blue-400 font-mono text-[11px]">${escapeHtml(ignoreData.filePath)}</code></p>
          </div>
          <div class="flex items-center space-x-3">
            <span id="rules-save-status" class="text-xs text-green-400 hidden">Saved successfully!</span>
            <button id="btn-toggle-raw" class="px-3 py-1.5 rounded-md text-xs font-medium border border-dark-600 ${
              activeTab === 'raw' ? 'bg-dark-600 text-white' : 'bg-dark-800 text-dark-100 hover:bg-dark-700'
            } transition-colors">
              ${activeTab === 'raw' ? '👁️ Switch to Visual Cards' : '📝 Raw Markdown Editor'}
            </button>
            <button id="btn-save-rules" class="px-4 py-1.5 rounded-md text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white transition-colors shadow">
              Save File
            </button>
          </div>
        </div>

        <!-- 3 Interactive Filter Tabs -->
        <div class="grid grid-cols-3 gap-4">
          <!-- Card 1: Learned from Rejected PRs -->
          <div 
            id="tab-rule-learned"
            class="rule-card-tab cursor-pointer p-4 rounded-xl border transition-all duration-150 ${
              activeTab === 'learned'
                ? 'bg-dark-700 border-blue-500 ring-2 ring-blue-500/20 shadow-lg'
                : 'bg-dark-800 border-dark-600 hover:border-dark-500 hover:bg-dark-750'
            }"
            data-tab="learned"
          >
            <div class="flex items-center justify-between text-xs font-medium text-dark-500 mb-1">
              <span class="${activeTab === 'learned' ? 'text-blue-400 font-semibold' : ''}">Learned from PRs</span>
              <span class="text-sm">🧠</span>
            </div>
            <div class="text-3xl font-extrabold ${activeTab === 'learned' ? 'text-blue-400' : 'text-white'}">
              ${architecturalRules.length}
            </div>
            <p class="text-[11px] text-dark-500 mt-1">Auto-distilled from rejection notes</p>
          </div>

          <!-- Card 2: Static Guardrails -->
          <div 
            id="tab-rule-static"
            class="rule-card-tab cursor-pointer p-4 rounded-xl border transition-all duration-150 ${
              activeTab === 'static'
                ? 'bg-dark-700 border-amber-500 ring-2 ring-amber-500/20 shadow-lg'
                : 'bg-dark-800 border-dark-600 hover:border-dark-500 hover:bg-dark-750'
            }"
            data-tab="static"
          >
            <div class="flex items-center justify-between text-xs font-medium text-dark-500 mb-1">
              <span class="${activeTab === 'static' ? 'text-amber-400 font-semibold' : ''}">Static Guardrails</span>
              <span class="text-sm">🛡️</span>
            </div>
            <div class="text-3xl font-extrabold ${activeTab === 'static' ? 'text-amber-400' : 'text-white'}">
              ${staticRules.length}
            </div>
            <p class="text-[11px] text-dark-500 mt-1">Permanent human-written exclusions</p>
          </div>

          <!-- Card 3: Evaluated Clean PRs -->
          <div 
            id="tab-rule-evaluated"
            class="rule-card-tab cursor-pointer p-4 rounded-xl border transition-all duration-150 ${
              activeTab === 'evaluated'
                ? 'bg-dark-700 border-green-500 ring-2 ring-green-500/20 shadow-lg'
                : 'bg-dark-800 border-dark-600 hover:border-dark-500 hover:bg-dark-750'
            }"
            data-tab="evaluated"
          >
            <div class="flex items-center justify-between text-xs font-medium text-dark-500 mb-1">
              <span class="${activeTab === 'evaluated' ? 'text-green-400 font-semibold' : ''}">Evaluated Clean PRs</span>
              <span class="text-sm">⚡</span>
            </div>
            <div class="text-3xl font-extrabold ${activeTab === 'evaluated' ? 'text-green-400' : 'text-white'}">
              ${evaluatedPrs.length}
            </div>
            <p class="text-[11px] text-dark-500 mt-1">Cached zero-token checked PRs</p>
          </div>
        </div>

        <!-- Tab Content View -->
        <div id="rule-tab-content" class="space-y-4">
          ${renderTabContent(activeTab, staticRules, architecturalRules, evaluatedPrs, raw)}
        </div>
      </div>
    `;

    // Attach card tab click listeners
    container.querySelectorAll('.rule-card-tab').forEach((card) => {
      card.addEventListener('click', () => {
        const selected = (card as HTMLElement).dataset.tab as RulesFilterTab;
        if (selected && selected !== activeTab) {
          activeTab = selected;
          render();
        }
      });
    });

    // Toggle Raw Editor
    document.getElementById('btn-toggle-raw')?.addEventListener('click', () => {
      activeTab = activeTab === 'raw' ? 'learned' : 'raw';
      render();
    });

    // Save File Button
    document.getElementById('btn-save-rules')?.addEventListener('click', async () => {
      const textarea = document.getElementById('rules-raw-editor') as HTMLTextAreaElement;
      const contentToSave = textarea ? textarea.value : raw;
      const btnSave = document.getElementById('btn-save-rules');
      const statusSpan = document.getElementById('rules-save-status');

      if (btnSave) btnSave.innerText = 'Saving...';
      await onSave(contentToSave);
      if (btnSave) btnSave.innerText = 'Save File';
      if (statusSpan) {
        statusSpan.classList.remove('hidden');
        setTimeout(() => statusSpan.classList.add('hidden'), 2500);
      }
    });
  }

  render();
}

function renderTabContent(
  tab: RulesFilterTab,
  staticRules: string[],
  architecturalRules: { prNumber?: number; title: string; rules: string[] }[],
  evaluatedPrs: number[],
  raw: string
): string {
  switch (tab) {
    case 'learned':
      return `
        <div class="space-y-3">
          <div class="flex items-center justify-between border-b border-dark-700 pb-2.5">
            <div>
              <h4 class="text-sm font-semibold text-white flex items-center space-x-2">
                <span>🧠</span>
                <span>Auto-Learned Architectural Exclusions (${architecturalRules.length})</span>
              </h4>
              <p class="text-xs text-dark-500 mt-0.5">
                When you decline a PR with an architectural reason, the AI distills it into permanent rules to prevent recurring suggestions across the codebase.
              </p>
            </div>
          </div>

          ${
            architecturalRules.length === 0
              ? `<div class="bg-dark-800 border border-dark-600 rounded-lg p-8 text-center text-xs text-dark-500">
                  No auto-learned architectural rules yet. When you reject a PR with an architectural note (e.g. <em>"no cross-tenant functionality"</em>), it will appear here.
                 </div>`
              : `<div class="space-y-3">
                  ${architecturalRules
                    .map(
                      (rule) => `
                    <div class="bg-dark-800 border border-dark-600 rounded-lg p-4 space-y-2.5 transition hover:border-dark-500">
                      <div class="flex items-center justify-between">
                        <span class="text-xs font-bold text-white">${escapeHtml(rule.title)}</span>
                        ${
                          rule.prNumber
                            ? `<span class="px-2 py-0.5 rounded text-[11px] font-mono bg-blue-950 text-blue-300 border border-blue-800">PR #${rule.prNumber}</span>`
                            : ''
                        }
                      </div>
                      <ul class="text-xs text-dark-100 list-disc list-inside space-y-1.5 leading-relaxed pl-1">
                        ${rule.rules.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}
                      </ul>
                    </div>
                  `
                    )
                    .join('')}
                 </div>`
          }
        </div>
      `;

    case 'static':
      return `
        <div class="space-y-3">
          <div class="flex items-center justify-between border-b border-dark-700 pb-2.5">
            <div>
              <h4 class="text-sm font-semibold text-white flex items-center space-x-2">
                <span>🛡️</span>
                <span>Static Guardrails (${staticRules.length})</span>
              </h4>
              <p class="text-xs text-dark-500 mt-0.5">
                Permanent human-defined rules that instruct the AI agent to skip specific directories, migration files, or dependencies.
              </p>
            </div>
          </div>

          ${
            staticRules.length === 0
              ? `<div class="bg-dark-800 border border-dark-600 rounded-lg p-8 text-center text-xs text-dark-500">
                  No static guardrails defined. Switch to Raw Markdown Editor to add rules like <code>- Do NOT touch legacy/</code>.
                 </div>`
              : `<div class="bg-dark-800 border border-dark-600 rounded-lg p-4 space-y-2">
                  <ul class="text-xs text-dark-100 list-disc list-inside space-y-2 leading-relaxed">
                    ${staticRules.map((rule) => `<li>${escapeHtml(rule)}</li>`).join('')}
                  </ul>
                 </div>`
          }
        </div>
      `;

    case 'evaluated':
      return `
        <div class="space-y-3">
          <div class="flex items-center justify-between border-b border-dark-700 pb-2.5">
            <div>
              <h4 class="text-sm font-semibold text-white flex items-center space-x-2">
                <span>⚡</span>
                <span>Evaluated Clean PRs (${evaluatedPrs.length})</span>
              </h4>
              <p class="text-xs text-dark-500 mt-0.5">
                These rejected PRs were evaluated by AI distillation and confirmed to contain no repository-wide architectural rules (e.g. rejected due to a failing test or typo). They are indexed silently (<code>&lt;!-- evaluated-pr: # --&gt;</code>) so subsequent nightly sweeps skip re-evaluating them with zero token overhead.
              </p>
            </div>
          </div>

          ${
            evaluatedPrs.length === 0
              ? `<div class="bg-dark-800 border border-dark-600 rounded-lg p-8 text-center text-xs text-dark-500">
                  No PRs marked as evaluated without rules yet.
                 </div>`
              : `<div class="bg-dark-800 border border-dark-600 rounded-lg p-4">
                  <div class="flex flex-wrap gap-2">
                    ${evaluatedPrs
                      .map(
                        (num) => `
                      <span class="px-2.5 py-1 rounded text-xs font-mono font-semibold bg-dark-700 text-green-400 border border-dark-600">
                        ✓ PR #${num}
                      </span>
                    `
                      )
                      .join('')}
                  </div>
                 </div>`
          }
        </div>
      `;

    case 'raw':
      return `
        <div class="space-y-3">
          <div class="flex items-center justify-between border-b border-dark-700 pb-2.5">
            <div>
              <h4 class="text-sm font-semibold text-white flex items-center space-x-2">
                <span>📝</span>
                <span>Raw Markdown Editor</span>
              </h4>
              <p class="text-xs text-dark-500 mt-0.5">
                Directly edit the markdown contents of your repository's ignore file. Click 'Save File' above when done.
              </p>
            </div>
          </div>

          <textarea 
            id="rules-raw-editor" 
            rows="16" 
            class="w-full bg-dark-800 border border-dark-600 rounded-lg p-4 font-mono text-xs text-dark-100 focus:outline-none focus:border-brand-500 leading-relaxed resize-y shadow-inner"
          >${escapeHtml(raw || '# Permanent Guardrails\n# Nightly Agent Exclusions & Rules\n- Do NOT touch legacy/\n')}</textarea>
        </div>
      `;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

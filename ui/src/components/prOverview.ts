import { PullRequestItem, RepoSpec } from '../types/electron';

type PrFilterTab = 'open' | 'merged' | 'declined';

export function renderPrOverview(
  container: HTMLElement,
  repo: RepoSpec,
  prs: { open: PullRequestItem[]; merged: PullRequestItem[]; declined: PullRequestItem[] }
) {
  const { open, merged, declined } = prs;

  // Initial active filter: prioritize 'open', then 'declined', then 'merged'
  let activeFilter: PrFilterTab = open.length > 0 ? 'open' : (declined.length > 0 ? 'declined' : 'merged');

  function render() {
    container.innerHTML = `
      <div class="space-y-6">
        <!-- Metric Cards (Acting as Interactive Filter Tabs) -->
        <div class="grid grid-cols-3 gap-4">
          <!-- Card 1: Awaiting Review -->
          <div 
            id="tab-card-open"
            class="card-filter cursor-pointer p-4 rounded-xl border transition-all duration-150 ${
              activeFilter === 'open'
                ? 'bg-dark-700 border-green-500 ring-2 ring-green-500/20 shadow-lg'
                : 'bg-dark-800 border-dark-600 hover:border-dark-500 hover:bg-dark-750'
            }"
            data-filter="open"
          >
            <div class="flex items-center justify-between text-xs font-medium text-dark-500 mb-1">
              <span class="${activeFilter === 'open' ? 'text-green-400 font-semibold' : ''}">Awaiting Review</span>
              <span class="w-2.5 h-2.5 rounded-full ${open.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-dark-600'}"></span>
            </div>
            <div class="text-3xl font-extrabold ${activeFilter === 'open' ? 'text-green-400' : 'text-white'}">
              ${open.length}
            </div>
            <p class="text-[11px] text-dark-500 mt-1">
              ${open.length >= 3 ? '⚠️ Backlog limit reached (paused)' : 'Click to view open PRs'}
            </p>
          </div>

          <!-- Card 2: Merged Sweeps -->
          <div 
            id="tab-card-merged"
            class="card-filter cursor-pointer p-4 rounded-xl border transition-all duration-150 ${
              activeFilter === 'merged'
                ? 'bg-dark-700 border-purple-500 ring-2 ring-purple-500/20 shadow-lg'
                : 'bg-dark-800 border-dark-600 hover:border-dark-500 hover:bg-dark-750'
            }"
            data-filter="merged"
          >
            <div class="flex items-center justify-between text-xs font-medium text-dark-500 mb-1">
              <span class="${activeFilter === 'merged' ? 'text-purple-400 font-semibold' : ''}">Merged Sweeps</span>
              <span class="w-2.5 h-2.5 rounded-full ${merged.length > 0 ? 'bg-purple-500' : 'bg-dark-600'}"></span>
            </div>
            <div class="text-3xl font-extrabold ${activeFilter === 'merged' ? 'text-purple-400' : 'text-white'}">
              ${merged.length}
            </div>
            <p class="text-[11px] text-dark-500 mt-1">Click to view accepted PRs</p>
          </div>

          <!-- Card 3: Do-Not-Repeat Ledger -->
          <div 
            id="tab-card-declined"
            class="card-filter cursor-pointer p-4 rounded-xl border transition-all duration-150 ${
              activeFilter === 'declined'
                ? 'bg-dark-700 border-red-500 ring-2 ring-red-500/20 shadow-lg'
                : 'bg-dark-800 border-dark-600 hover:border-dark-500 hover:bg-dark-750'
            }"
            data-filter="declined"
          >
            <div class="flex items-center justify-between text-xs font-medium text-dark-500 mb-1">
              <span class="${activeFilter === 'declined' ? 'text-red-400 font-semibold' : ''}">Do-Not-Repeat Ledger</span>
              <span class="w-2.5 h-2.5 rounded-full ${declined.length > 0 ? 'bg-red-500' : 'bg-dark-600'}"></span>
            </div>
            <div class="text-3xl font-extrabold ${activeFilter === 'declined' ? 'text-red-400' : 'text-white'}">
              ${declined.length}
            </div>
            <p class="text-[11px] text-dark-500 mt-1">Click to view declined & excluded</p>
          </div>
        </div>

        <!-- Filtered Content List -->
        <div id="filtered-pr-list" class="space-y-4">
          ${renderFilteredList(activeFilter, open, merged, declined)}
        </div>
      </div>
    `;

    // Attach card tab click listeners
    container.querySelectorAll('.card-filter').forEach((card) => {
      card.addEventListener('click', () => {
        const selected = (card as HTMLElement).dataset.filter as PrFilterTab;
        if (selected && selected !== activeFilter) {
          activeFilter = selected;
          render();
        }
      });
    });

    // Attach external link openers (opens in system default browser to preserve GitHub login session)
    container.querySelectorAll('.btn-open-github').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const url = (btn as HTMLElement).dataset.url;
        if (url) {
          window.electronAPI.openExternal(url);
        }
      });
    });
  }

  render();
}

function renderFilteredList(
  filter: PrFilterTab,
  open: PullRequestItem[],
  merged: PullRequestItem[],
  declined: PullRequestItem[]
): string {
  switch (filter) {
    case 'open':
      return `
        <div class="space-y-3">
          <div class="flex items-center justify-between border-b border-dark-700 pb-2.5">
            <h3 class="text-sm font-semibold text-white flex items-center space-x-2">
              <span class="w-2 h-2 rounded-full bg-green-500"></span>
              <span>Pull Requests Awaiting Review (${open.length})</span>
            </h3>
            <span class="text-xs text-dark-500">Click title or button to review on GitHub</span>
          </div>

          ${
            open.length === 0
              ? `<div class="bg-dark-800 border border-dark-600 rounded-lg p-8 text-center text-xs text-dark-500">
                  🎉 No open automated PRs awaiting review. The review backlog is clear.
                 </div>`
              : `<div class="space-y-2.5">
                  ${open.map((pr) => renderPrCard(pr)).join('')}
                 </div>`
          }
        </div>
      `;

    case 'merged':
      return `
        <div class="space-y-3">
          <div class="flex items-center justify-between border-b border-dark-700 pb-2.5">
            <h3 class="text-sm font-semibold text-white flex items-center space-x-2">
              <span class="w-2 h-2 rounded-full bg-purple-500"></span>
              <span>Merged Pull Requests (${merged.length})</span>
            </h3>
            <span class="text-xs text-dark-500">Accepted improvements</span>
          </div>

          ${
            merged.length === 0
              ? `<div class="bg-dark-800 border border-dark-600 rounded-lg p-8 text-center text-xs text-dark-500">
                  No merged automated PRs yet.
                 </div>`
              : `<div class="space-y-2.5">
                  ${merged.map((pr) => renderPrCard(pr)).join('')}
                 </div>`
          }
        </div>
      `;

    case 'declined':
      return `
        <div class="space-y-3">
          <div class="flex items-center justify-between border-b border-dark-700 pb-2.5">
            <div>
              <h3 class="text-sm font-semibold text-white flex items-center space-x-2">
                <span class="w-2 h-2 rounded-full bg-red-500"></span>
                <span>Declined Pull Requests & Do-Not-Repeat Memory (${declined.length})</span>
              </h3>
              <p class="text-xs text-dark-500 mt-0.5">
                These rejected fingerprints and rejection comments are automatically injected into future prompt exclusions.
              </p>
            </div>
          </div>

          ${
            declined.length === 0
              ? `<div class="bg-dark-800 border border-dark-600 rounded-lg p-8 text-center text-xs text-dark-500">
                  No declined PRs on record.
                 </div>`
              : `<div class="space-y-2.5">
                  ${declined.map((pr) => renderPrCard(pr)).join('')}
                 </div>`
          }
        </div>
      `;
  }
}

function renderPrCard(pr: PullRequestItem): string {
  const isDeclined = pr.state === 'CLOSED' && !pr.isMerged;
  const isMerged = pr.isMerged;

  return `
    <div class="bg-dark-800 border border-dark-600 rounded-lg p-4 space-y-3 transition hover:border-dark-500">
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-1 flex-1 min-w-0">
          <div class="flex items-center space-x-2 flex-wrap gap-y-1">
            <span class="font-mono text-xs text-dark-500 font-semibold">#${pr.number}</span>
            <button 
              class="btn-open-github text-sm font-semibold text-left text-white hover:text-blue-400 hover:underline transition-colors"
              data-url="${escapeHtml(pr.url)}"
              title="Open in your default web browser"
            >
              ${escapeHtml(pr.title)}
            </button>
            ${
              pr.category
                ? `<span class="px-2 py-0.5 rounded text-[10px] font-medium bg-dark-700 text-dark-100 border border-dark-600">${escapeHtml(pr.category)}</span>`
                : ''
            }
          </div>
          <span class="text-[11px] text-dark-500 font-mono">${new Date(pr.createdAt).toLocaleString()}</span>
        </div>

        <div class="flex items-center space-x-2.5 flex-shrink-0">
          <button 
            class="btn-open-github flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium bg-dark-700 hover:bg-dark-600 text-dark-100 border border-dark-600 transition-colors"
            data-url="${escapeHtml(pr.url)}"
            title="Open in browser"
          >
            <span>GitHub</span>
            <span class="text-[10px]">↗</span>
          </button>

          <span class="px-2.5 py-1 text-xs font-bold rounded ${
            isMerged
              ? 'bg-purple-950 text-purple-300 border border-purple-800'
              : isDeclined
              ? 'bg-red-950 text-red-300 border border-red-800'
              : 'bg-green-950 text-green-300 border border-green-800'
          }">
            ${isMerged ? 'MERGED' : isDeclined ? 'DECLINED' : 'OPEN'}
          </span>
        </div>
      </div>

      ${
        pr.fingerprint
          ? `<div class="text-xs bg-dark-900/90 p-3 rounded-md border border-dark-700 space-y-1.5">
              <div><strong class="text-dark-50 font-medium">Change Fingerprint:</strong> <span class="text-dark-100">${escapeHtml(pr.fingerprint)}</span></div>
              ${pr.targetScope ? `<div><strong class="text-dark-50 font-medium">Target Scope:</strong> <code class="text-blue-400 text-[11px] font-mono">${escapeHtml(pr.targetScope)}</code></div>` : ''}
             </div>`
          : ''
      }

      ${
        pr.reviewerNotes && pr.reviewerNotes.length > 0
          ? `<div class="text-xs bg-red-950/25 border border-red-900/60 p-3 rounded-md space-y-1">
              <strong class="text-red-400 flex items-center space-x-1">
                <span>💬</span>
                <span>Reviewer Rejection Note:</span>
              </strong>
              <p class="text-dark-100 italic pl-5">"${escapeHtml(pr.reviewerNotes.join('; '))}"</p>
             </div>`
          : ''
      }
    </div>
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

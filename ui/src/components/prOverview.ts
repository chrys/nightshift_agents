import { PullRequestItem, RepoSpec } from '../types/electron';

export function renderPrOverview(
  container: HTMLElement,
  repo: RepoSpec,
  prs: { open: PullRequestItem[]; merged: PullRequestItem[]; declined: PullRequestItem[] }
) {
  const { open, merged, declined } = prs;

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Metric Cards -->
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-dark-800 border border-dark-600 p-4 rounded-xl">
          <div class="flex items-center justify-between text-xs font-medium text-dark-500 mb-1">
            <span>Awaiting Review</span>
            <span class="w-2 h-2 rounded-full bg-green-500"></span>
          </div>
          <div class="text-2xl font-bold text-white">${open.length}</div>
          <p class="text-[11px] text-dark-500 mt-1">${open.length >= 3 ? '⚠️ Backlog limit reached (paused)' : 'Normal queue'}</p>
        </div>

        <div class="bg-dark-800 border border-dark-600 p-4 rounded-xl">
          <div class="flex items-center justify-between text-xs font-medium text-dark-500 mb-1">
            <span>Merged Sweeps</span>
            <span class="w-2 h-2 rounded-full bg-purple-500"></span>
          </div>
          <div class="text-2xl font-bold text-white">${merged.length}</div>
          <p class="text-[11px] text-dark-500 mt-1">Successfully accepted improvements</p>
        </div>

        <div class="bg-dark-800 border border-dark-600 p-4 rounded-xl">
          <div class="flex items-center justify-between text-xs font-medium text-dark-500 mb-1">
            <span>Do-Not-Repeat Ledger</span>
            <span class="w-2 h-2 rounded-full bg-red-500"></span>
          </div>
          <div class="text-2xl font-bold text-white">${declined.length}</div>
          <p class="text-[11px] text-dark-500 mt-1">Declined & excluded from future prompts</p>
        </div>
      </div>

      <!-- Section: Open PRs -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-white flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-green-500"></span>
            <span>Open Pull Requests (${open.length})</span>
          </h3>
          <span class="text-xs text-dark-500">Review on GitHub</span>
        </div>

        ${
          open.length === 0
            ? `<div class="bg-dark-800 border border-dark-600 rounded-lg p-6 text-center text-xs text-dark-500">
                No open automated PRs awaiting review.
               </div>`
            : `<div class="space-y-2">
                ${open.map(pr => renderPrCard(pr)).join('')}
               </div>`
        }
      </div>

      <!-- Section: Declined PRs (Do-Not-Repeat Memory) -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-white flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-red-500"></span>
            <span>Declined PRs & Do-Not-Repeat Memory (${declined.length})</span>
          </h3>
          <span class="text-xs text-dark-500">Automatically fed into prompt exclusions</span>
        </div>

        ${
          declined.length === 0
            ? `<div class="bg-dark-800 border border-dark-600 rounded-lg p-6 text-center text-xs text-dark-500">
                No declined PRs on record.
               </div>`
            : `<div class="space-y-2">
                ${declined.map(pr => renderPrCard(pr)).join('')}
               </div>`
        }
      </div>

      <!-- Section: Merged PRs -->
      ${
        merged.length > 0
          ? `<div class="space-y-3">
              <h3 class="text-sm font-semibold text-white flex items-center space-x-2">
                <span class="w-2 h-2 rounded-full bg-purple-500"></span>
                <span>Merged PRs (${merged.length})</span>
              </h3>
              <div class="space-y-2">
                ${merged.map(pr => renderPrCard(pr)).join('')}
              </div>
            </div>`
          : ''
      }
    </div>
  `;
}

function renderPrCard(pr: PullRequestItem): string {
  const isDeclined = pr.state === 'CLOSED' && !pr.isMerged;
  const isMerged = pr.isMerged;

  return `
    <div class="bg-dark-800 border border-dark-600 rounded-lg p-4 space-y-2.5 transition hover:border-dark-500">
      <div class="flex items-start justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <span class="font-mono text-xs text-dark-500 font-semibold">#${pr.number}</span>
            <a href="${pr.url}" target="_blank" class="text-sm font-medium text-white hover:text-blue-400 hover:underline">
              ${escapeHtml(pr.title)}
            </a>
            ${
              pr.category
                ? `<span class="px-2 py-0.5 rounded text-[10px] font-medium bg-dark-700 text-dark-100 border border-dark-600">${pr.category}</span>`
                : ''
            }
          </div>
          <span class="text-[11px] text-dark-500">${new Date(pr.createdAt).toLocaleString()}</span>
        </div>

        <span class="px-2 py-0.5 text-xs font-semibold rounded ${
          isMerged
            ? 'bg-purple-900/40 text-purple-300 border border-purple-800'
            : isDeclined
            ? 'bg-red-900/40 text-red-300 border border-red-800'
            : 'bg-green-900/40 text-green-300 border border-green-800'
        }">
          ${isMerged ? 'MERGED' : isDeclined ? 'DECLINED' : 'OPEN'}
        </span>
      </div>

      ${
        pr.fingerprint
          ? `<div class="text-xs bg-dark-900/80 p-2.5 rounded border border-dark-700 space-y-1">
              <div><strong class="text-dark-50">Fingerprint:</strong> <span class="text-dark-100">${escapeHtml(pr.fingerprint)}</span></div>
              ${pr.targetScope ? `<div><strong class="text-dark-50">Scope:</strong> <code class="text-blue-400 text-[11px] font-mono">${escapeHtml(pr.targetScope)}</code></div>` : ''}
             </div>`
          : ''
      }

      ${
        pr.reviewerNotes && pr.reviewerNotes.length > 0
          ? `<div class="text-xs bg-red-950/20 border border-red-900/50 p-2.5 rounded space-y-1">
              <strong class="text-red-400">Reviewer Rejection Note:</strong>
              <p class="text-dark-100 italic">"${escapeHtml(pr.reviewerNotes.join('; '))}"</p>
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

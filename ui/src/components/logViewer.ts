import { LogFileInfo, RepoSpec } from '../types/electron';
// @ts-ignore
import AnsiToHtml from 'ansi-to-html';

const ansiConverter = new AnsiToHtml({
  fg: '#c9d1d9',
  bg: '#0d1117',
  newline: true,
  escapeXML: true,
});

export function renderLogViewer(
  container: HTMLElement,
  repo: RepoSpec,
  availableLogs: LogFileInfo[],
  liveLogs: string,
  isSweepRunning: boolean,
  onSelectLogFile: (filePath: string) => Promise<string>
) {
  const repoLogs = availableLogs.filter((l) => l.repoName === repo.name);

  container.innerHTML = `
    <div class="h-full flex flex-col space-y-4">
      <!-- Controls Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <label class="text-xs font-semibold text-dark-50 uppercase tracking-wider">Log Source:</label>
          <select id="select-log-source" class="bg-dark-800 border border-dark-600 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500 font-mono">
            <option value="LIVE" ${isSweepRunning || liveLogs ? 'selected' : ''}>⚡ Live Terminal Output ${isSweepRunning ? '(Running...)' : ''}</option>
            ${repoLogs
              .map(
                (log) => `
              <option value="${log.filePath}">
                📅 ${log.date} (${(log.sizeBytes / 1024).toFixed(1)} KB)
              </option>
            `
              )
              .join('')}
          </select>
        </div>

        <div class="flex items-center space-x-2">
          <label class="flex items-center space-x-1.5 text-xs text-dark-500 cursor-pointer">
            <input type="checkbox" id="chk-autoscroll" checked class="rounded bg-dark-700 border-dark-600 text-brand-500 focus:ring-0">
            <span>Auto-scroll</span>
          </label>
          <button id="btn-clear-terminal" class="px-2.5 py-1 bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded text-xs text-dark-100">
            Clear
          </button>
        </div>
      </div>

      <!-- Terminal Window -->
      <div 
        id="terminal-window" 
        class="flex-1 bg-dark-900 border border-dark-600 rounded-lg p-4 font-mono text-xs overflow-y-auto leading-relaxed shadow-inner"
        style="min-height: 480px; max-height: calc(100vh - 280px);"
      >
        <div id="terminal-content" class="text-dark-100 whitespace-pre-wrap select-text">
          ${renderContent(liveLogs || 'No active terminal output. Run a sweep or select a historical log above.')}
        </div>
      </div>
    </div>
  `;

  const selectSource = document.getElementById('select-log-source') as HTMLSelectElement;
  const terminalContent = document.getElementById('terminal-content');
  const terminalWindow = document.getElementById('terminal-window');
  const btnClear = document.getElementById('btn-clear-terminal');
  const chkAutoscroll = document.getElementById('chk-autoscroll') as HTMLInputElement;

  selectSource?.addEventListener('change', async () => {
    const val = selectSource.value;
    if (val === 'LIVE') {
      if (terminalContent) {
        terminalContent.innerHTML = renderContent(liveLogs || 'No active terminal output.');
      }
    } else {
      if (terminalContent) terminalContent.innerText = 'Loading log file...';
      const content = await onSelectLogFile(val);
      if (terminalContent) {
        terminalContent.innerHTML = renderContent(content);
      }
    }
  });

  btnClear?.addEventListener('click', () => {
    if (terminalContent) terminalContent.innerHTML = '';
  });

  if (chkAutoscroll?.checked && terminalWindow) {
    terminalWindow.scrollTop = terminalWindow.scrollHeight;
  }
}

export function appendLiveLogChunk(chunk: string) {
  const terminalContent = document.getElementById('terminal-content');
  const terminalWindow = document.getElementById('terminal-window');
  const chkAutoscroll = document.getElementById('chk-autoscroll') as HTMLInputElement;
  const selectSource = document.getElementById('select-log-source') as HTMLSelectElement;

  if (selectSource && selectSource.value !== 'LIVE') {
    selectSource.value = 'LIVE';
  }

  if (terminalContent) {
    terminalContent.innerHTML += renderContent(chunk);
    if (chkAutoscroll?.checked && terminalWindow) {
      terminalWindow.scrollTop = terminalWindow.scrollHeight;
    }
  }
}

function renderContent(raw: string): string {
  try {
    return ansiConverter.toHtml(raw);
  } catch {
    return escapeHtml(raw);
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


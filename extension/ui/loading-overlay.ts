const HOST_ID = '__se_loading_host__';

let host: HTMLElement | null = null;
let messageEl: HTMLElement | null = null;
let barEl: HTMLElement | null = null;

export function showExtractLoading(message = 'Extracting styles…'): void {
  hideExtractLoading();

  host = document.createElement('div');
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    .mask {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: grid;
      place-items: center;
      background: rgba(12, 12, 12, 0.42);
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    }
    .card {
      width: min(360px, calc(100vw - 32px));
      padding: 22px 22px 18px;
      border-radius: 14px;
      background: #1e1e1e;
      color: rgba(255,255,255,0.92);
      border: 1px solid rgba(255,255,255,0.08);
    }
    .row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .spinner {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.16);
      border-top-color: #0d99ff;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }
    .title {
      font-size: 14px;
      font-weight: 600;
    }
    .message {
      margin-top: 4px;
      font-size: 12px;
      color: rgba(255,255,255,0.5);
      min-height: 16px;
    }
    .track {
      margin-top: 14px;
      height: 4px;
      border-radius: 99px;
      background: rgba(255,255,255,0.08);
      overflow: hidden;
    }
    .bar {
      height: 100%;
      width: 8%;
      border-radius: 99px;
      background: #0d99ff;
      transition: width 0.25s ease;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;

  const mask = document.createElement('div');
  mask.className = 'mask';
  mask.innerHTML = `
    <div class="card">
      <div class="row">
        <div class="spinner"></div>
        <div>
          <div class="title">Extracting styles</div>
          <div class="message"></div>
        </div>
      </div>
      <div class="track"><div class="bar"></div></div>
    </div>
  `;

  shadow.append(style, mask);
  messageEl = mask.querySelector('.message');
  barEl = mask.querySelector('.bar');
  if (messageEl) messageEl.textContent = message;
  document.documentElement.appendChild(host);
}

export function updateExtractLoading(message: string, ratio?: number): void {
  if (messageEl) messageEl.textContent = message;
  if (barEl && typeof ratio === 'number') {
    const pct = Math.max(6, Math.min(100, Math.round(ratio * 100)));
    barEl.style.width = `${pct}%`;
  }
}

export function hideExtractLoading(): void {
  host?.remove();
  host = null;
  messageEl = null;
  barEl = null;
}

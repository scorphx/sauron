/**
 * AiIntelBar — glass AI query input mounted below the map panel-header.
 * User types a natural language query → calls /api/ai-intel/v1/ask-intel
 * → shows summary + dispatches ai-intel-actions event for the globe.
 */

interface IntelAction {
  type: string;
  payload: Record<string, unknown>;
}

interface IntelResult {
  summary: string;
  actions?: IntelAction[];
}

export class AiIntelBar {
  private el: HTMLElement;
  private input: HTMLInputElement;
  private result: HTMLElement;
  private loading = false;
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'ai-intel-bar';
    this.el.innerHTML = `
      <div class="ai-intel-input-wrap">
        <svg class="ai-intel-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
        </svg>
        <input
          type="text"
          class="ai-intel-input"
          placeholder="Ask the globe… e.g. show Eastern Europe conflicts"
          maxlength="200"
          autocomplete="off"
          spellcheck="false"
        />
        <div class="ai-intel-spinner" aria-hidden="true"></div>
        <kbd class="ai-intel-hint">↵</kbd>
      </div>
      <div class="ai-intel-result" role="status" aria-live="polite"></div>
    `;

    this.input = this.el.querySelector<HTMLInputElement>('.ai-intel-input')!;
    this.result = this.el.querySelector<HTMLElement>('.ai-intel-result')!;

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = this.input.value.trim();
        if (q) this.query(q);
      }
      if (e.key === 'Escape') {
        this.input.blur();
        this.clear();
      }
    });

    // Close result on click outside
    document.addEventListener('click', (e) => {
      if (!this.el.contains(e.target as Node)) this.clear();
    });

    container.appendChild(this.el);
  }

  private async query(q: string): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.el.classList.add('loading');
    this.clear();

    try {
      const region = (document.getElementById('regionSelect') as HTMLSelectElement | null)?.value ?? 'global';
      const url = `/api/ai-intel/v1/ask-intel?query=${encodeURIComponent(q)}&region=${encodeURIComponent(region)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await res.json()) as IntelResult;

      this.showResult(data.summary);

      if (Array.isArray(data.actions) && data.actions.length > 0) {
        window.dispatchEvent(new CustomEvent('ai-intel-actions', { detail: data.actions }));
      }
    } catch {
      this.showResult('Intelligence query unavailable — check LLM provider config.');
    } finally {
      this.loading = false;
      this.el.classList.remove('loading');
    }
  }

  private showResult(text: string): void {
    if (this.dismissTimer) clearTimeout(this.dismissTimer);
    this.result.textContent = text;
    this.result.classList.add('visible');
    this.dismissTimer = setTimeout(() => this.clear(), 14_000);
  }

  private clear(): void {
    if (this.dismissTimer) { clearTimeout(this.dismissTimer); this.dismissTimer = null; }
    this.result.classList.remove('visible');
  }

  destroy(): void {
    if (this.dismissTimer) clearTimeout(this.dismissTimer);
    this.el.remove();
  }
}

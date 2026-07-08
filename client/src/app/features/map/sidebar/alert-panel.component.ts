import { Component, inject } from '@angular/core';
import { RealtimeService } from '../../../core/services/realtime.service';

@Component({
  selector: 'app-alert-panel',
  template: `
    <div class="alert-panel">
      <h3>Service Alerts</h3>

      @if (realtimeService.reconnecting()) {
        <div class="alert-panel__banner">Reconnecting…</div>
      }

      @if (!realtimeService.connected() && !realtimeService.reconnecting() && realtimeService.stale()) {
        <div class="alert-panel__banner alert-panel__banner--error">
          Connection lost. <button (click)="realtimeService.retry()">Retry</button>
        </div>
      }

      @for (alert of realtimeService.alerts(); track alert.id) {
        <div class="alert-panel__item">
          <div class="alert-panel__item-header">
            <span class="alert-panel__cause">{{ alert.cause }}</span>
            <span class="alert-panel__effect">{{ alert.effect }}</span>
          </div>
          <p class="alert-panel__header-text">{{ alert.headerText }}</p>
          <p class="alert-panel__desc">{{ alert.descriptionText }}</p>
        </div>
      }

      @if (realtimeService.alerts().length === 0) {
        <div class="alert-panel__empty">No active alerts</div>
      }
    </div>
  `,
  styles: [`
    .alert-panel h3 {
      margin: 0 0 0.5rem;
      font-size: 1rem;
    }
    .alert-panel__banner {
      padding: 0.5rem;
      background: #fff3e0;
      border-radius: 4px;
      margin-bottom: 0.5rem;
      font-size: 0.875rem;
    }
    .alert-panel__banner--error {
      background: #ffebee;
    }
    .alert-panel__banner--error button {
      background: none;
      border: 1px solid #d32f2f;
      border-radius: 4px;
      color: #d32f2f;
      cursor: pointer;
      padding: 0.125rem 0.5rem;
      font-size: 0.75rem;
    }
    .alert-panel__item {
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      padding: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .alert-panel__item-header {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.25rem;
    }
    .alert-panel__cause, .alert-panel__effect {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.125rem 0.375rem;
      border-radius: 3px;
    }
    .alert-panel__cause {
      background: #fff3e0;
      color: #e65100;
    }
    .alert-panel__effect {
      background: #fce4ec;
      color: #c62828;
    }
    .alert-panel__header-text {
      margin: 0 0 0.25rem;
      font-size: 0.875rem;
      font-weight: 500;
    }
    .alert-panel__desc {
      margin: 0;
      font-size: 0.8125rem;
      color: #666;
    }
    .alert-panel__empty {
      color: #999;
      font-size: 0.875rem;
    }
  `],
})
export class AlertPanelComponent {
  protected readonly realtimeService = inject(RealtimeService);
}

import { Component, inject } from '@angular/core';
import { RealtimeService } from '../../../core/services/realtime.service';

@Component({
  selector: 'app-alert-panel',
  template: `
    <div class="alert-panel">
      <div class="alert-panel__header">
        <h3>Service Alerts</h3>
        @if (realtimeService.alerts().length > 0) {
          <span class="alert-panel__count">{{ realtimeService.alerts().length }}</span>
        }
      </div>

      @for (alert of realtimeService.alerts(); track alert.id) {
        <div class="alert-panel__item">
          <div class="alert-panel__item-tags">
            <span class="alert-panel__tag alert-panel__tag--cause">{{ alert.cause }}</span>
            <span class="alert-panel__tag alert-panel__tag--effect">{{ alert.effect }}</span>
          </div>
          @if (alert.headerText) {
            <p class="alert-panel__title">{{ alert.headerText }}</p>
          }
          @if (alert.descriptionText) {
            <p class="alert-panel__desc">{{ alert.descriptionText }}</p>
          }
        </div>
      }

      @if (realtimeService.alerts().length === 0) {
        <div class="alert-panel__empty">No active alerts</div>
      }
    </div>
  `,
  styles: [`
    .alert-panel__header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .alert-panel__header h3 {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 600;
    }
    .alert-panel__count {
      background: var(--color-error);
      color: #fff;
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.1rem 0.4rem;
      border-radius: 10px;
      min-width: 18px;
      text-align: center;
    }
    .alert-panel__item {
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 0.625rem 0.75rem;
      margin-bottom: 0.5rem;
      background: var(--color-bg-card);
    }
    .alert-panel__item-tags {
      display: flex;
      gap: 0.375rem;
      margin-bottom: 0.375rem;
      flex-wrap: wrap;
    }
    .alert-panel__tag {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.1rem 0.4rem;
      border-radius: var(--radius-sm);
    }
    .alert-panel__tag--cause {
      background: var(--color-warning-light);
      color: var(--color-warning);
    }
    .alert-panel__tag--effect {
      background: var(--color-error-light);
      color: var(--color-error);
    }
    .alert-panel__title {
      margin: 0 0 0.25rem;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .alert-panel__desc {
      margin: 0;
      font-size: 0.8rem;
      color: var(--color-text-secondary);
      line-height: 1.4;
    }
    .alert-panel__empty {
      color: var(--color-text-muted);
      font-size: 0.85rem;
      padding: 0.5rem 0;
    }
  `],
})
export class AlertPanelComponent {
  protected readonly realtimeService = inject(RealtimeService);
}

import { Component, input, output } from '@angular/core';
import { Agency } from '@shared/models/agency.model';

@Component({
  selector: 'app-agency-card',
  template: `
    <div class="agency-card" (click)="select.emit(agency())">
      <div class="agency-card__header">
        <h3 class="agency-card__name">{{ agency().name }}</h3>
        @if (agency().feedName) {
          <span class="agency-card__feed-name">{{ agency().feedName }}</span>
        }
        @if (agency().location) {
          <span class="agency-card__location">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {{ agency().location }}, {{ agency().state }}
          </span>
        } @else {
          <span class="agency-card__location">{{ agency().state }}</span>
        }
      </div>
      <div class="agency-card__footer">
        @if (agency().hasRealtime) {
          <span class="agency-card__badge agency-card__badge--live">
            <span class="agency-card__dot"></span>
            Live tracking
          </span>
        }
      </div>
    </div>
  `,
  styles: [`
    .agency-card {
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 1.25rem;
      cursor: pointer;
      background: var(--color-bg-card);
      transition: all var(--transition);
      display: flex;
      flex-direction: column;
      gap: 1rem;
      min-height: 130px;
    }
    .agency-card:hover {
      border-color: var(--color-primary);
      box-shadow: var(--shadow-md);
      transform: translateY(-1px);
    }
    .agency-card__header {
      flex: 1;
    }
    .agency-card__name {
      font-size: 1.05rem;
      font-weight: 600;
      margin-bottom: 0.375rem;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .agency-card__feed-name {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--color-primary);
      background: var(--color-primary-light);
      padding: 0.1rem 0.5rem;
      border-radius: var(--radius-sm);
      margin-bottom: 0.375rem;
    }
    .agency-card__location {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--color-text-secondary);
      font-size: 0.85rem;
    }
    .agency-card__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .agency-card__badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.625rem;
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      font-weight: 600;
    }
    .agency-card__badge--live {
      background: var(--color-success-light);
      color: var(--color-success);
    }
    .agency-card__dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--color-success);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `],
})
export class AgencyCardComponent {
  readonly agency = input.required<Agency>();
  readonly select = output<Agency>();
}

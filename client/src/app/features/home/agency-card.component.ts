import { Component, input, output } from '@angular/core';
import { Agency } from '@shared/models/agency.model';

@Component({
  selector: 'app-agency-card',
  template: `
    <div class="agency-card" (click)="select.emit(agency())">
      <div class="agency-card__header">
        <h3 class="agency-card__name">{{ agency().name }}</h3>
        <span class="agency-card__location">{{ agency().location }}, {{ agency().state }}</span>
      </div>
      <div class="agency-card__body">
        @if (agency().hasRealtime) {
          <span class="agency-card__badge agency-card__badge--live">Live</span>
        } @else {
          <span class="agency-card__badge agency-card__badge--static">Static only</span>
        }
      </div>
    </div>
  `,
  styles: [`
    .agency-card {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 1rem;
      cursor: pointer;
      transition: box-shadow 0.2s, border-color 0.2s;
    }
    .agency-card:hover {
      border-color: #1976d2;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .agency-card__header {
      margin-bottom: 0.75rem;
    }
    .agency-card__name {
      margin: 0;
      font-size: 1.1rem;
    }
    .agency-card__location {
      color: #666;
      font-size: 0.875rem;
    }
    .agency-card__body {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .agency-card__badge {
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .agency-card__badge--live {
      background: #e8f5e9;
      color: #2e7d32;
    }
    .agency-card__badge--static {
      background: #f5f5f5;
      color: #757575;
    }
  `],
})
export class AgencyCardComponent {
  readonly agency = input.required<Agency>();
  readonly select = output<Agency>();
}

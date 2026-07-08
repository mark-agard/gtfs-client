import { Component, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { AgencyService } from '../../core/services/agency.service';
import { Agency } from '@shared/models/agency.model';
import { AgencyCardComponent } from './agency-card.component';

@Component({
  selector: 'app-city-selector',
  imports: [AgencyCardComponent],
  template: `
    <div class="city-selector">
      <div class="city-selector__search-wrap">
        <svg class="city-selector__search-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          class="city-selector__search"
          placeholder="Search by city, agency, or state..."
          (input)="onSearch($event)"
        />
      </div>

      @if (agencyService.loading()) {
        <div class="city-selector__grid">
          @for (item of skeletons; track $index) {
            <div class="city-selector__skeleton"></div>
          }
        </div>
      } @else if (agencyService.error()) {
        <div class="city-selector__error">{{ agencyService.error() }}</div>
      } @else {
        @if (agencyService.agencies().length > 0) {
          <div class="city-selector__meta">
            {{ agencyService.total() }} agencies found
          </div>
        }

        <div class="city-selector__grid">
          @for (agency of agencyService.agencies(); track agency.id) {
            <app-agency-card [agency]="agency" (select)="onSelect($event)" />
          }
        </div>

        @if (agencyService.agencies().length === 0) {
          <div class="city-selector__empty">No agencies found</div>
        }

        @if (totalPages() > 1) {
          <div class="city-selector__pagination">
            <button
              class="city-selector__page-btn"
              [disabled]="agencyService.page() === 1"
              (click)="onPageChange(agencyService.page() - 1)"
            >← Prev</button>
            <span class="city-selector__page-info">
              Page {{ agencyService.page() }} of {{ totalPages() }}
            </span>
            <button
              class="city-selector__page-btn"
              [disabled]="agencyService.page() === totalPages()"
              (click)="onPageChange(agencyService.page() + 1)"
            >Next →</button>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .city-selector {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .city-selector__search-wrap {
      position: relative;
    }
    .city-selector__search-icon {
      position: absolute;
      left: 0.875rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--color-text-muted);
      pointer-events: none;
    }
    .city-selector__search {
      width: 100%;
      padding: 0.875rem 1rem 0.875rem 2.75rem;
      font-size: 1rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      box-sizing: border-box;
      background: var(--color-bg-card);
      box-shadow: var(--shadow-sm);
    }
    .city-selector__meta {
      font-size: 0.875rem;
      color: var(--color-text-secondary);
      padding-left: 0.25rem;
    }
    .city-selector__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1rem;
    }
    .city-selector__skeleton {
      height: 120px;
      border-radius: var(--radius-md);
      background: linear-gradient(90deg, var(--color-border-light) 25%, #e8e8e8 50%, var(--color-border-light) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .city-selector__empty, .city-selector__error {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--color-text-muted);
    }
    .city-selector__error {
      color: var(--color-error);
    }
    .city-selector__pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding-top: 0.5rem;
    }
    .city-selector__page-btn {
      padding: 0.5rem 1rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-bg-card);
      color: var(--color-text);
      font-size: 0.875rem;
      transition: all var(--transition);

      &:hover:not(:disabled) {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
    }
    .city-selector__page-info {
      font-size: 0.875rem;
      color: var(--color-text-secondary);
    }
  `],
})
export class CitySelectorComponent {
  private readonly router = inject(Router);
  protected readonly agencyService = inject(AgencyService);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private currentSearch = '';

  readonly skeletons = Array(12).fill(0);

  readonly totalPages = computed(() =>
    Math.ceil(this.agencyService.total() / this.agencyService.pageSize()),
  );

  onSearch(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.currentSearch = query;

    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }

    this.searchTimer = setTimeout(() => {
      this.agencyService.fetchAgencies(1, 50, query || undefined);
    }, 300);
  }

  onPageChange(page: number): void {
    this.agencyService.fetchAgencies(page, 50, this.currentSearch || undefined);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onSelect(agency: Agency): void {
    this.router.navigate(['/agency', agency.id]);
  }
}

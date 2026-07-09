import { Component, inject, signal, computed } from '@angular/core';
import { GtfsService } from '../../../core/services/gtfs.service';

@Component({
  selector: 'app-route-list',
  template: `
    <div class="route-list">
      <div class="route-list__header">
        <h3>Routes</h3>
        @if (gtfsService.routes().length > 0) {
          <span class="route-list__count">{{ filteredRoutes().length }} of {{ gtfsService.routes().length }}</span>
        }
      </div>
      @if (gtfsService.loading()) {
        <div class="route-list__loading">Loading routes…</div>
      } @else {
        <input
          type="text"
          class="route-list__filter"
          placeholder="Filter routes…"
          [value]="filter()"
          (input)="onFilter($event)"
        />
        <div class="route-list__actions">
          <button class="route-list__action" (click)="showAllFiltered()">Show all</button>
          <button class="route-list__action" (click)="hideAllFiltered()">Hide all</button>
        </div>
        <div class="route-list__items">
          @for (route of filteredRoutes(); track route.id) {
            <label class="route-list__item">
              <input
                type="checkbox"
                [checked]="!gtfsService.hiddenRoutes().has(route.id)"
                (change)="onToggle($event, route.id)"
              />
              @if (route.shortName) {
                <span class="route-list__badge" [style.background]="'#' + route.color" [style.color]="textColor(route.color)">{{ route.shortName }}</span>
              }
              <span class="route-list__name">{{ route.longName }}</span>
            </label>
          }
          @if (filteredRoutes().length === 0) {
            <div class="route-list__empty">No routes found</div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .route-list {
      margin-bottom: 1.5rem;
    }
    .route-list__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }
    .route-list__header h3 {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 600;
    }
    .route-list__count {
      font-size: 0.75rem;
      color: var(--color-text-muted);
    }
    .route-list__filter {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      box-sizing: border-box;
      margin-bottom: 0.5rem;
      font-size: 0.85rem;
    }
    .route-list__items {
      max-height: 400px;
      overflow-y: auto;
    }
    .route-list__item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.3rem 0;
      cursor: pointer;
      border-radius: var(--radius-sm);
      transition: background var(--transition);

      &:hover {
        background: var(--color-bg-hover);
      }
    }
    .route-list__item input[type="checkbox"] {
      margin: 0;
      cursor: pointer;
    }
    .route-list__color {
      width: 14px;
      height: 14px;
      border-radius: 3px;
      flex-shrink: 0;
      border: 1px solid rgba(0, 0, 0, 0.1);
    }
    .route-list__name {
      font-size: 0.85rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .route-list__actions {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .route-list__action {
      background: none;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 0.25rem 0.6rem;
      font-size: 0.75rem;
      color: var(--color-text-muted);
      cursor: pointer;
      transition: all var(--transition);

      &:hover {
        background: var(--color-primary-light);
        color: var(--color-primary);
        border-color: var(--color-primary);
      }
    }
    .route-list__badge {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.1rem 0.35rem;
      border-radius: 3px;
      flex-shrink: 0;
      line-height: 1.3;
    }
    .route-list__loading, .route-list__empty {
      color: var(--color-text-muted);
      font-size: 0.85rem;
      padding: 0.5rem 0;
    }
  `],
})
export class RouteListComponent {
  protected readonly gtfsService = inject(GtfsService);

  private readonly _filter = signal('');
  readonly filter = this._filter.asReadonly();

  readonly filteredRoutes = computed(() => {
    const query = this.filter().toLowerCase().trim();
    if (!query) return this.gtfsService.routes();
    return this.gtfsService.routes().filter(
      (r) =>
        r.shortName.toLowerCase().includes(query) ||
        r.longName.toLowerCase().includes(query),
    );
  });

  onFilter(event: Event): void {
    this._filter.set((event.target as HTMLInputElement).value);
  }

  onToggle(event: Event, routeId: string): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.gtfsService.toggleRoute(routeId, checked);
  }

  showAllFiltered(): void {
    const hidden = this.gtfsService.hiddenRoutes();
    for (const route of this.filteredRoutes()) {
      if (hidden.has(route.id)) {
        this.gtfsService.toggleRoute(route.id, true);
      }
    }
  }

  hideAllFiltered(): void {
    const hidden = this.gtfsService.hiddenRoutes();
    for (const route of this.filteredRoutes()) {
      if (!hidden.has(route.id)) {
        this.gtfsService.toggleRoute(route.id, false);
      }
    }
  }

  textColor(bgColor: string): string {
    const r = parseInt(bgColor.slice(0, 2), 16);
    const g = parseInt(bgColor.slice(2, 4), 16);
    const b = parseInt(bgColor.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000' : '#fff';
  }
}

import { Component, inject, signal, computed } from '@angular/core';
import { GtfsService } from '../../../core/services/gtfs.service';

@Component({
  selector: 'app-route-list',
  template: `
    <div class="route-list">
      <h3>Routes</h3>
      <input
        type="text"
        class="route-list__filter"
        placeholder="Filter routes..."
        [value]="filter()"
        (input)="onFilter($event)"
      />
      <div class="route-list__items">
        @for (route of filteredRoutes(); track route.id) {
          <label class="route-list__item">
            <input type="checkbox" checked (change)="onToggle($event, route.id)" />
            <span
              class="route-list__color"
              [style.background]="'#' + route.color"
            ></span>
            <span class="route-list__name">{{ route.shortName }} {{ route.longName }}</span>
          </label>
        }
        @if (filteredRoutes().length === 0) {
          <div class="route-list__empty">No routes loaded</div>
        }
      </div>
    </div>
  `,
  styles: [`
    .route-list {
      margin-bottom: 1.5rem;
    }
    .route-list h3 {
      margin: 0 0 0.5rem;
      font-size: 1rem;
    }
    .route-list__filter {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-sizing: border-box;
      margin-bottom: 0.5rem;
    }
    .route-list__items {
      max-height: 300px;
      overflow-y: auto;
    }
    .route-list__item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.25rem 0;
      cursor: pointer;
    }
    .route-list__color {
      width: 12px;
      height: 12px;
      border-radius: 2px;
      flex-shrink: 0;
    }
    .route-list__name {
      font-size: 0.875rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .route-list__empty {
      color: #999;
      font-size: 0.875rem;
      padding: 0.5rem 0;
    }
  `],
})
export class RouteListComponent {
  private readonly gtfsService = inject(GtfsService);

  private readonly _filter = signal('');
  readonly filter = this._filter.asReadonly();
  readonly hiddenRoutes = signal<Set<string>>(new Set());

  readonly filteredRoutes = computed(() => {
    const query = this.filter().toLowerCase().trim();
    const hidden = this.hiddenRoutes();
    return this.gtfsService
      .routes()
      .filter((r) => {
        if (hidden.has(r.id)) return false;
        if (!query) return true;
        return (
          r.shortName.toLowerCase().includes(query) ||
          r.longName.toLowerCase().includes(query)
        );
      });
  });

  onFilter(event: Event): void {
    this._filter.set((event.target as HTMLInputElement).value);
  }

  onToggle(event: Event, routeId: string): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.hiddenRoutes.update((set) => {
      const next = new Set(set);
      if (checked) {
        next.delete(routeId);
      } else {
        next.add(routeId);
      }
      return next;
    });
  }
}

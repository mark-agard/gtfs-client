import { Component, inject, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AgencyService } from '../../core/services/agency.service';
import { Agency } from '@shared/models/agency.model';
import { AgencyCardComponent } from './agency-card.component';

@Component({
  selector: 'app-city-selector',
  imports: [AgencyCardComponent],
  template: `
    <div class="city-selector">
      <input
        type="text"
        class="city-selector__search"
        placeholder="Search by city, agency, or state..."
        [value]="searchQuery()"
        (input)="onSearch($event)"
      />

      @if (agencyService.loading()) {
        <div class="city-selector__status">Loading agencies...</div>
      }

      @if (agencyService.error()) {
        <div class="city-selector__error">{{ agencyService.error() }}</div>
      }

      <div class="city-selector__grid">
        @for (agency of filteredAgencies(); track agency.id) {
          <app-agency-card [agency]="agency" (select)="onSelect($event)" />
        }
      </div>

      @if (!agencyService.loading() && filteredAgencies().length === 0) {
        <div class="city-selector__empty">No agencies found</div>
      }
    </div>
  `,
  styles: [`
    .city-selector {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .city-selector__search {
      width: 100%;
      padding: 0.75rem 1rem;
      font-size: 1rem;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-sizing: border-box;
    }
    .city-selector__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }
    .city-selector__status, .city-selector__error, .city-selector__empty {
      text-align: center;
      padding: 2rem;
      color: #666;
    }
    .city-selector__error {
      color: #d32f2f;
    }
  `],
})
export class CitySelectorComponent {
  private readonly router = inject(Router);
  protected readonly agencyService = inject(AgencyService);

  private readonly _searchQuery = signal('');

  readonly searchQuery = this._searchQuery.asReadonly();

  readonly filteredAgencies = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const agencies = this.agencyService.agencies();

    if (!query) return agencies;

    return agencies.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        a.location.toLowerCase().includes(query) ||
        a.state.toLowerCase().includes(query),
    );
  });

  onSearch(event: Event): void {
    this._searchQuery.set((event.target as HTMLInputElement).value);
  }

  onSelect(agency: Agency): void {
    this.router.navigate(['/agency', agency.id]);
  }
}

import { Component, inject } from '@angular/core';
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
        (input)="onSearch($event)"
      />

      @if (agencyService.loading()) {
        <div class="city-selector__status">Loading agencies...</div>
      }

      @if (agencyService.error()) {
        <div class="city-selector__error">{{ agencyService.error() }}</div>
      }

      <div class="city-selector__grid">
        @for (agency of agencyService.agencies(); track agency.id) {
          <app-agency-card [agency]="agency" (select)="onSelect($event)" />
        }
      </div>

      @if (!agencyService.loading() && agencyService.agencies().length === 0) {
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

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  onSearch(event: Event): void {
    const query = (event.target as HTMLInputElement).value;

    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }

    this.searchTimer = setTimeout(() => {
      this.agencyService.fetchAgencies(1, 50, query || undefined);
    }, 300);
  }

  onSelect(agency: Agency): void {
    this.router.navigate(['/agency', agency.id]);
  }
}

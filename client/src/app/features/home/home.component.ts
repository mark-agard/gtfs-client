import { Component, inject, OnInit } from '@angular/core';
import { AgencyService } from '../../core/services/agency.service';
import { CitySelectorComponent } from './city-selector.component';

@Component({
  selector: 'app-home',
  imports: [CitySelectorComponent],
  template: `
    <div class="home">
      <header class="home__header">
        <h1 class="home__title">GTFS Client</h1>
        <p class="home__subtitle">Explore live transit data from U.S. transit agencies</p>
      </header>
      <app-city-selector />
    </div>
  `,
  styles: [`
    .home {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem 3rem;
    }
    .home__header {
      text-align: center;
      margin-bottom: 2.5rem;
    }
    .home__title {
      font-size: 2.25rem;
      font-weight: 700;
      color: var(--color-text);
      letter-spacing: -0.5px;
    }
    .home__subtitle {
      color: var(--color-text-secondary);
      margin-top: 0.5rem;
      font-size: 1.05rem;
    }
  `],
})
export class HomeComponent implements OnInit {
  private readonly agencyService = inject(AgencyService);

  ngOnInit(): void {
    this.agencyService.fetchAgencies();
  }
}

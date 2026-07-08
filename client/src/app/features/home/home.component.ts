import { Component, inject, OnInit } from '@angular/core';
import { AgencyService } from '../../core/services/agency.service';
import { CitySelectorComponent } from './city-selector.component';

@Component({
  selector: 'app-home',
  imports: [CitySelectorComponent],
  template: `
    <div class="home">
      <header class="home__header">
        <h1>GTFS Client</h1>
        <p>Select a U.S. transit agency to explore live transit data</p>
      </header>
      <app-city-selector />
    </div>
  `,
  styles: [`
    .home {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }
    .home__header {
      text-align: center;
      margin-bottom: 2rem;
    }
    .home__header h1 {
      font-size: 2.5rem;
      margin: 0;
    }
    .home__header p {
      color: #666;
      margin: 0.5rem 0 0;
    }
  `],
})
export class HomeComponent implements OnInit {
  private readonly agencyService = inject(AgencyService);

  ngOnInit(): void {
    this.agencyService.fetchAgencies();
  }
}

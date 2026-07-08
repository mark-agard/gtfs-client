import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AgencyService } from '../../core/services/agency.service';
import { GtfsService } from '../../core/services/gtfs.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { MapComponent } from './map/map.component';
import { RouteListComponent } from './sidebar/route-list.component';
import { AlertPanelComponent } from './sidebar/alert-panel.component';

@Component({
  selector: 'app-map-page',
  imports: [MapComponent, RouteListComponent, AlertPanelComponent, RouterLink],
  template: `
    <div class="map-page">
      @if (agencyService.error()) {
        <div class="map-page__error">
          <p>{{ agencyService.error() }}</p>
          <a routerLink="/">Back to city selector</a>
        </div>
      } @else if (agencyService.selectedAgency()) {
        <div class="map-page__main">
          <div class="map-page__map-area">
            @if (realtimeService.reconnecting()) {
              <div class="map-page__banner map-page__banner--reconnecting">
                Reconnecting…
              </div>
            }
            @if (realtimeService.connected() === false && realtimeService.reconnecting() === false && agencyService.selectedAgency()?.hasRealtime) {
              <div class="map-page__banner map-page__banner--lost">
                Connection lost. <button (click)="realtimeService.retry()">Retry</button>
              </div>
            }
            <app-map />
          </div>
          <div class="map-page__sidebar">
            <div class="map-page__sidebar-header">
              <h2>{{ agencyService.selectedAgency()?.name }}</h2>
              <a routerLink="/" class="map-page__back">← Back</a>
            </div>
            <app-route-list />
            <app-alert-panel />
          </div>
        </div>
      } @else {
        <div class="map-page__loading">Loading agency...</div>
      }
    </div>
  `,
  styles: [`
    .map-page {
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .map-page__main {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
    .map-page__map-area {
      display: flex;
      flex: 1;
      position: relative;
      min-width: 0;
    }
    .map-page__banner {
      position: absolute;
      top: 0.5rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      padding: 0.375rem 1rem;
      border-radius: 4px;
      font-size: 0.875rem;
      font-weight: 500;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    .map-page__banner--reconnecting {
      background: #fff3e0;
      color: #e65100;
    }
    .map-page__banner--lost {
      background: #ffebee;
      color: #c62828;
    }
    .map-page__banner--lost button {
      background: #c62828;
      color: #fff;
      border: none;
      padding: 0.125rem 0.5rem;
      border-radius: 3px;
      cursor: pointer;
      margin-left: 0.25rem;
    }
    .map-page__sidebar {
      width: 320px;
      border-left: 1px solid #e0e0e0;
      overflow-y: auto;
      padding: 1rem;
      box-sizing: border-box;
    }
    .map-page__sidebar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }
    .map-page__sidebar-header h2 {
      margin: 0;
      font-size: 1.25rem;
    }
    .map-page__back {
      color: #1976d2;
      text-decoration: none;
      font-size: 0.875rem;
    }
    .map-page__loading, .map-page__error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #666;
    }
    .map-page__error a {
      color: #1976d2;
      margin-top: 0.5rem;
    }
  `],
})
export class MapPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  protected readonly agencyService = inject(AgencyService);
  private readonly gtfsService = inject(GtfsService);
  protected readonly realtimeService = inject(RealtimeService);

  ngOnInit(): void {
    const agencyId = this.route.snapshot.paramMap.get('id');
    if (!agencyId) return;

    this.agencyService.fetchAgencyDetail(agencyId).subscribe({
      next: (detail) => {
        queueMicrotask(() => {
          this.agencyService.selectAgency(detail);
          this.gtfsService.loadStaticData(agencyId);
          if (detail.hasRealtime) {
            this.realtimeService.connect(agencyId);
          }
        });
      },
      error: (err) => {
        this.agencyService.error.set(err.message ?? 'Failed to load agency');
      },
    });
  }

  ngOnDestroy(): void {
    this.realtimeService.disconnect();
    this.gtfsService.clear();
    this.agencyService.clearSelection();
  }
}

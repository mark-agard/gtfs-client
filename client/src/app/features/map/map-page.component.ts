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
      } @else if (agencyService.selectedAgency() && !gtfsService.loading()) {
        <div class="map-page__main">
          <div class="map-page__map-area">
            @if (realtimeService.reconnecting()) {
              <div class="map-page__banner map-page__banner--reconnecting">
                <span class="map-page__banner-dot"></span>
                Reconnecting…
              </div>
            }
            @if (realtimeService.connected() === false && realtimeService.reconnecting() === false && agencyService.selectedAgency()?.hasRealtime) {
              <div class="map-page__banner map-page__banner--lost">
                Connection lost <button (click)="realtimeService.retry()">Retry</button>
              </div>
            }
            @if (agencyService.selectedAgency()?.realtimeStatus === 'requires_auth') {
              <div class="map-page__banner map-page__banner--info">
                Live tracking requires an API key from this agency
              </div>
            }
            @if (agencyService.selectedAgency()?.realtimeStatus === 'none') {
              <div class="map-page__banner map-page__banner--info">
                No realtime data available for this agency
              </div>
            }
            <app-map />
          </div>
          <div class="map-page__sidebar">
            <div class="map-page__sidebar-header">
              <div>
                <h2>{{ agencyService.selectedAgency()?.name }}</h2>
                @if (agencyService.selectedAgency()?.feedName) {
                  <span class="map-page__feed-name">{{ agencyService.selectedAgency()?.feedName }}</span>
                }
                @if (agencyService.selectedAgency()?.location) {
                  <span class="map-page__agency-location">
                    {{ agencyService.selectedAgency()?.location }}, {{ agencyService.selectedAgency()?.state }}
                  </span>
                } @else {
                  <span class="map-page__agency-location">{{ agencyService.selectedAgency()?.state }}</span>
                }
              </div>
              <a routerLink="/" class="map-page__back">← Back</a>
            </div>
            <div class="map-page__sidebar-content">
              <app-route-list />
              <app-alert-panel />
            </div>
          </div>
        </div>
      } @else {
        <div class="map-page__loading">
          <div class="map-page__spinner"></div>
          <p>Loading routes and stops…</p>
        </div>
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
      top: 0.75rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      padding: 0.5rem 1.25rem;
      border-radius: var(--radius-md);
      font-size: 0.875rem;
      font-weight: 500;
      box-shadow: var(--shadow-md);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .map-page__banner--reconnecting {
      background: var(--color-warning-light);
      color: var(--color-warning);
    }
    .map-page__banner-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--color-warning);
      animation: pulse 1.5s infinite;
    }
    .map-page__banner--lost {
      background: var(--color-error-light);
      color: var(--color-error);
    }
    .map-page__banner--info {
      background: var(--color-bg-card);
      color: var(--color-text-muted);
      border: 1px solid var(--color-border);
    }
    .map-page__banner--lost button {
      background: var(--color-error);
      color: #fff;
      padding: 0.2rem 0.6rem;
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      font-weight: 600;
      margin-left: 0.25rem;
    }
    .map-page__sidebar {
      width: 340px;
      border-left: 1px solid var(--color-border);
      background: var(--color-bg-card);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .map-page__sidebar-header {
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--color-border);
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .map-page__sidebar-header h2 {
      font-size: 1.1rem;
      font-weight: 600;
      margin: 0;
    }
    .map-page__agency-location {
      font-size: 0.8rem;
      color: var(--color-text-muted);
    }
    .map-page__feed-name {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 600;
      color: var(--color-primary);
      background: var(--color-primary-light);
      padding: 0.1rem 0.4rem;
      border-radius: var(--radius-sm);
      margin-right: 0.5rem;
    }
    .map-page__back {
      color: var(--color-primary);
      font-size: 0.8rem;
      white-space: nowrap;
      padding-top: 0.15rem;
    }
    .map-page__sidebar-content {
      flex: 1;
      overflow-y: auto;
      padding: 1.25rem;
    }
    .map-page__loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 1rem;
      color: var(--color-text-muted);
    }
    .map-page__spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--color-border);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    .map-page__error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 0.5rem;
      color: var(--color-error);
    }
    .map-page__error a {
      color: var(--color-primary);
    }
  `],
})
export class MapPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  protected readonly agencyService = inject(AgencyService);
  protected readonly gtfsService = inject(GtfsService);
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

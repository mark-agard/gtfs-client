import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Agency, AgencyDetail } from '@shared/models/agency.model';

@Injectable({ providedIn: 'root' })
export class AgencyService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/agencies';

  readonly agencies = signal<Agency[]>([]);
  readonly total = signal(0);
  readonly selectedAgency = signal<AgencyDetail | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  fetchAgencies(page = 1, pageSize = 50, search?: string): void {
    this.loading.set(true);
    this.error.set(null);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) params.set('search', search);
    this.http
      .get<{ agencies: Agency[]; total: number }>(
        `${this.baseUrl}?${params.toString()}`,
      )
      .subscribe({
        next: (res) => {
          this.agencies.set(res.agencies);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err.message ?? 'Failed to load agencies');
          this.loading.set(false);
        },
      });
  }

  fetchAgencyDetail(id: string): Observable<AgencyDetail> {
    return this.http.get<AgencyDetail>(`${this.baseUrl}/${id}`);
  }

  selectAgency(agency: AgencyDetail): void {
    this.selectedAgency.set(agency);
  }

  clearSelection(): void {
    this.selectedAgency.set(null);
  }
}

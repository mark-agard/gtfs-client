import { Agency, AgencyDetail } from '@shared/models/agency.model';
import { Cache } from '../utils/cache.js';

const MOBILITY_DB_API = 'https://api.mobilitydatabase.org';
const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

export class MobilityDbService {
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private readonly agencyCache: Cache<Agency[]>;

  constructor() {
    this.agencyCache = new Cache<Agency[]>(24 * 60 * 60 * 1000);
  }

  private async getRefreshToken(): Promise<string> {
    const token = process.env.MOBILITY_DB_REFRESH_TOKEN;
    if (!token) {
      throw new Error('MOBILITY_DB_REFRESH_TOKEN is not set');
    }
    return token;
  }

  private async fetchAccessToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - TOKEN_REFRESH_THRESHOLD_MS) {
      return;
    }

    const refreshToken = await this.getRefreshToken();
    const res = await fetch(`${MOBILITY_DB_API}/v1/secure_tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch access token: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as TokenResponse;
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
  }

  private async apiGet<T>(path: string): Promise<T> {
    await this.fetchAccessToken();
    const res = await fetch(`${MOBILITY_DB_API}${path}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (!res.ok) {
      throw new Error(`MobilityDB API error: ${res.status} ${await res.text()}`);
    }

    return res.json() as Promise<T>;
  }

  async listUsAgencies(): Promise<Agency[]> {
    const cached = this.agencyCache.get('us-agencies');
    if (cached) return cached;

    // TODO: Implement full pagination — API may return results in pages
    const data = await this.apiGet<{ results: MobilityDbFeed[] }>(
      '/v1/gtfs_feeds?status=active&country=US&limit=1000',
    );

    const agencies: Agency[] = data.results.map((feed) => ({
      id: feed.id,
      name: feed.provider,
      location: feed.location?.municipality ?? 'Unknown',
      state: feed.location?.subdivision_name ?? 'Unknown',
      routeCount: 0,
      hasRealtime: false,
      feedStatus: feed.status === 'active' ? 'active' : 'inactive',
    }));

    this.agencyCache.set('us-agencies', agencies);
    return agencies;
  }

  async getAgencyDetail(id: string): Promise<AgencyDetail> {
    const feed = await this.apiGet<MobilityDbFeed>(`/v1/gtfs_feeds/${id}`);

    let hasRealtime = false;
    try {
      const rtFeeds = await this.apiGet<{ results: MobilityDbRtFeed[] }>(
        `/v1/gtfs_feeds/${id}/gtfs_rt_feeds`,
      );
      hasRealtime = rtFeeds.results.length > 0;
    } catch {
      hasRealtime = false;
    }

    return {
      id: feed.id,
      name: feed.provider,
      url: feed.provider_url ?? '',
      timezone: feed.timezone ?? 'America/New_York',
      location: feed.location?.municipality ?? 'Unknown',
      state: feed.location?.subdivision_name ?? 'Unknown',
      routeCount: 0,
      hasRealtime,
      feedStatus: feed.status === 'active' ? 'active' : 'inactive',
      boundingBox: feed.bounding_box
        ? {
            minLat: feed.bounding_box.min_latitude,
            minLon: feed.bounding_box.min_longitude,
            maxLat: feed.bounding_box.max_latitude,
            maxLon: feed.bounding_box.max_longitude,
          }
        : undefined,
    };
  }

  async getFeedDownloadUrl(id: string): Promise<string | undefined> {
    const feed = await this.apiGet<MobilityDbFeed>(`/v1/gtfs_feeds/${id}`);
    return feed.latest_dataset?.hosted_url ?? feed.direct_download_url;
  }

  async getRealtimeFeedUrls(id: string): Promise<string[]> {
    try {
      const data = await this.apiGet<{ results: MobilityDbRtFeed[] }>(
        `/v1/gtfs_feeds/${id}/gtfs_rt_feeds`,
      );
      return data.results.map((f) => f.feed_url).filter((u): u is string => !!u);
    } catch {
      return [];
    }
  }
}

interface MobilityDbFeed {
  id: string;
  provider: string;
  provider_url?: string;
  status: string;
  timezone?: string;
  direct_download_url?: string;
  latest_dataset?: {
    hosted_url?: string;
  };
  location?: {
    municipality?: string;
    subdivision_name?: string;
    country?: string;
  };
  bounding_box?: {
    min_latitude: number;
    min_longitude: number;
    max_latitude: number;
    max_longitude: number;
  };
}

interface MobilityDbRtFeed {
  id: string;
  feed_url?: string;
  entity_types?: string[];
}

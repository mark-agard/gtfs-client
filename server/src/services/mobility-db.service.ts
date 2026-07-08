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
    const res = await fetch(`${MOBILITY_DB_API}/v1/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch access token: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as TokenResponse;
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
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

  async listUsAgencies(
    page = 1,
    pageSize = 50,
    search?: string,
  ): Promise<{ agencies: Agency[]; total: number }> {
    let cached = this.agencyCache.get('us-agencies');

    if (!cached) {
      const allFeeds: MobilityDbFeed[] = [];
      const limit = 1000;
      let offset = 0;

      while (true) {
        const batch = await this.apiGet<MobilityDbFeed[]>(
          `/v1/gtfs_feeds?status=active&limit=${limit}&offset=${offset}`,
        );
        allFeeds.push(...batch);
        if (batch.length < limit) break;
        offset += limit;
      }

      cached = allFeeds
        .filter(
          (feed) =>
            feed.locations?.some((l) => l.country_code === 'US') &&
            feed.latest_dataset?.hosted_url &&
            feed.bounding_box,
        )
        .map((feed) => ({
          id: feed.id,
          name: feed.provider,
          feedName: feed.feed_name ?? '',
          ...this.deriveLocation(feed.locations),
          routeCount: 0,
          hasRealtime: false,
          feedStatus: feed.status === 'active' ? 'active' : 'inactive',
        }));

      this.agencyCache.set('us-agencies', cached);
    }

    let filtered = cached;
    if (search) {
      const q = search.toLowerCase();
      filtered = cached.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.location.toLowerCase().includes(q) ||
          a.state.toLowerCase().includes(q),
      );
    }

    const start = (page - 1) * pageSize;
    return {
      agencies: filtered.slice(start, start + pageSize),
      total: filtered.length,
    };
  }

  async getAgencyDetail(id: string): Promise<AgencyDetail> {
    const feed = await this.apiGet<MobilityDbFeed>(`/v1/gtfs_feeds/${id}`);

    let hasRealtime = false;
    let realtimeStatus: 'available' | 'requires_auth' | 'none' = 'none';
    try {
      const rtInfo = await this.getRealtimeFeedInfo(id);
      hasRealtime = rtInfo.accessible.length > 0;
      realtimeStatus = hasRealtime ? 'available' : (rtInfo.authRequired ? 'requires_auth' : 'none');
    } catch {
      hasRealtime = false;
    }

    return {
      id: feed.id,
      name: feed.provider,
      feedName: feed.feed_name ?? '',
      url: feed.source_info?.producer_url ?? '',
      timezone: feed.latest_dataset?.agency_timezone ?? 'America/New_York',
      ...this.deriveLocation(feed.locations),
      routeCount: 0,
      hasRealtime,
      realtimeStatus,
      feedStatus: feed.status === 'active' ? 'active' : 'inactive',
      boundingBox: feed.bounding_box
        ? {
            minLat: feed.bounding_box.minimum_latitude,
            minLon: feed.bounding_box.minimum_longitude,
            maxLat: feed.bounding_box.maximum_latitude,
            maxLon: feed.bounding_box.maximum_longitude,
          }
        : undefined,
    };
  }

  async getFeedDownloadUrl(id: string): Promise<string | undefined> {
    const feed = await this.apiGet<MobilityDbFeed>(`/v1/gtfs_feeds/${id}`);
    return feed.latest_dataset?.hosted_url ?? feed.source_info?.producer_url;
  }

  private static readonly STATE_ABBREV: Record<string, string> = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
    'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT',
    'Delaware': 'DE', 'District of Columbia': 'DC', 'Florida': 'FL',
    'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL',
    'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS', 'Kentucky': 'KY',
    'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN',
    'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT',
    'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH',
    'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
    'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
    'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA',
    'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD',
    'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
    'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
    'Wisconsin': 'WI', 'Wyoming': 'WY',
  };

  private deriveLocation(locations?: MobilityDbFeed['locations']): { location: string; state: string } {
    const usLocations = (locations ?? []).filter((l) => l.country_code === 'US');
    const states = [...new Set(usLocations.map((l) => l.subdivision_name).filter((s): s is string => !!s))];
    const stateList = states.map((s) => MobilityDbService.STATE_ABBREV[s] ?? s).sort().join(' · ');
    const isMultiState = states.length > 1;
    return {
      location: isMultiState ? '' : (usLocations[0]?.municipality ?? 'Unknown'),
      state: stateList || 'Unknown',
    };
  }

  async getRealtimeFeedUrls(id: string): Promise<{ url: string; entityType: string }[]> {
    const result = await this.getRealtimeFeedInfo(id);
    return result.accessible;
  }

  async getRealtimeFeedInfo(id: string): Promise<{
    accessible: { url: string; entityType: string }[];
    authRequired: boolean;
  }> {
    try {
      const feeds = await this.apiGet<MobilityDbRtFeed[]>(
        `/v1/gtfs_feeds/${id}/gtfs_rt_feeds`,
      );
      const accessible = feeds
        .filter((f) => !f.source_info?.authentication_type)
        .map((f) => ({
          url: f.source_info?.producer_url ?? '',
          entityType: f.entity_types?.[0] ?? 'vp',
        }))
        .filter((f) => f.url.length > 0);

      const hasAuthFeeds = feeds.some((f) => f.source_info?.authentication_type);

      return { accessible, authRequired: accessible.length === 0 && hasAuthFeeds };
    } catch {
      return { accessible: [], authRequired: false };
    }
  }
}

interface MobilityDbFeed {
  id: string;
  provider: string;
  feed_name?: string;
  status: string;
  source_info?: {
    producer_url?: string;
  };
  latest_dataset?: {
    hosted_url?: string;
    agency_timezone?: string;
  };
  locations?: {
    municipality?: string;
    subdivision_name?: string;
    country_code?: string;
  }[];
  bounding_box?: {
    minimum_latitude: number;
    minimum_longitude: number;
    maximum_latitude: number;
    maximum_longitude: number;
  };
}

interface MobilityDbRtFeed {
  id: string;
  entity_types?: string[];
  source_info?: {
    producer_url?: string;
    authentication_type?: number;
    api_key_parameter_name?: string;
  };
}

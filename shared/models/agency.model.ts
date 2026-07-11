export interface Agency {
  id: string;
  name: string;
  feedName: string;
  location: string;
  state: string;
  hasRealtime: boolean;
  feedStatus: 'active' | 'inactive' | 'unknown';
}

export interface AgencyDetail {
  id: string;
  name: string;
  feedName: string;
  url: string;
  timezone: string;
  location: string;
  state: string;
  hasRealtime: boolean;
  realtimeStatus: 'available' | 'requires_auth' | 'none';
  feedStatus: 'active' | 'inactive' | 'unknown';
  boundingBox?: {
    minLat: number;
    minLon: number;
    maxLat: number;
    maxLon: number;
  };
}

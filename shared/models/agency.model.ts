export interface Agency {
  id: string;
  name: string;
  feedName: string;
  location: string;
  state: string;
  routeCount: number;
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
  routeCount: number;
  hasRealtime: boolean;
  feedStatus: 'active' | 'inactive' | 'unknown';
  boundingBox?: {
    minLat: number;
    minLon: number;
    maxLat: number;
    maxLon: number;
  };
}

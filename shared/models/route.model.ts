export interface Route {
  id: string;
  agencyId: string;
  shortName: string;
  longName: string;
  type: RouteType;
  color: string;
  textColor: string;
}

export enum RouteType {
  Tram = 0,
  Subway = 1,
  Rail = 2,
  Bus = 3,
  Ferry = 4,
  CableTram = 5,
  AerialLift = 6,
  Funicular = 7,
  Trolleybus = 11,
  Monorail = 12,
}

export interface RouteFeature {
  type: 'Feature';
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  properties: Route;
}

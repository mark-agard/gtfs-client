export interface Stop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  locationType?: StopLocationType;
}

export enum StopLocationType {
  Stop = 0,
  Station = 1,
  Entrance = 2,
  GenericNode = 3,
  BoardingArea = 4,
}

export interface StopFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: Stop;
}

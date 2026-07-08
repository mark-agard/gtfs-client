export interface VehiclePosition {
  vehicleId: string;
  tripId: string;
  routeId: string;
  lat: number;
  lon: number;
  bearing: number;
  speed: number;
  timestamp: number;
  currentStopSequence?: number;
  currentStatus?: VehicleStopStatus;
}

export enum VehicleStopStatus {
  IncomingAt = 0,
  StoppedAt = 1,
  InTransitTo = 2,
}

export interface ServiceAlert {
  id: string;
  cause: string;
  effect: string;
  headerText: string;
  descriptionText: string;
  severityLevel: string;
  activePeriod: { start: number; end: number }[];
  informedEntities: { routeId?: string; stopId?: string }[];
}

import { Injectable, signal } from '@angular/core';
import { VehiclePosition, ServiceAlert } from '@shared/models/vehicle-position.model';

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  readonly vehiclePositions = signal<VehiclePosition[]>([]);
  readonly alerts = signal<ServiceAlert[]>([]);
  readonly connected = signal(false);
  readonly reconnecting = signal(false);
  readonly stale = signal(false);

  private socket: WebSocket | null = null;
  private agencyId: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pongReceived = true;

  private static readonly MAX_RETRIES = 10;
  private static readonly HEARTBEAT_INTERVAL = 30000;

  connect(agencyId: string): void {
    this.agencyId = agencyId;
    this.doConnect();
  }

  private doConnect(): void {
    if (!this.agencyId) return;

    const wsUrl = this.buildWsUrl(this.agencyId);
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      this.connected.set(true);
      this.reconnecting.set(false);
      this.stale.set(false);
      this.reconnectAttempts = 0;
      this.startHeartbeat();
    };

    this.socket.onmessage = (event) => {
      let data: any;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      if (data.type === 'pong') {
        this.pongReceived = true;
        return;
      }

      if (data.type === 'snapshot' || data.type === 'update') {
        this.vehiclePositions.set(data.positions);
      }

      if (data.type === 'alerts') {
        this.alerts.set(data.alerts);
      }
    };

    this.socket.onclose = () => {
      this.connected.set(false);
      this.stopHeartbeat();

      if (this.reconnectAttempts < RealtimeService.MAX_RETRIES) {
        this.reconnecting.set(true);
        this.stale.set(true);
        this.scheduleReconnect();
      } else {
        this.reconnecting.set(false);
      }
    };

    this.socket.onerror = () => {
      this.socket?.close();
    };
  }

  private scheduleReconnect(): void {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    const jitter = Math.random() * 500;
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.doConnect();
    }, delay + jitter);
  }

  private startHeartbeat(): void {
    this.pongReceived = true;
    this.heartbeatTimer = setInterval(() => {
      if (!this.pongReceived) {
        this.socket?.close();
        return;
      }
      this.pongReceived = false;
      this.socket?.send(JSON.stringify({ type: 'ping' }));
    }, RealtimeService.HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    this.socket?.close();
    this.socket = null;
    this.agencyId = null;
    this.reconnectAttempts = 0;
    this.connected.set(false);
    this.reconnecting.set(false);
    this.stale.set(false);
    this.vehiclePositions.set([]);
    this.alerts.set([]);
  }

  retry(): void {
    this.reconnectAttempts = 0;
    this.doConnect();
  }

  private buildWsUrl(agencyId: string): string {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${proto}//${host}/api/agencies/${agencyId}/realtime`;
  }
}

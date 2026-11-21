import { EventEmitter } from 'node:events';

export type EventType = 'observation' | 'alert' | 'approval' | 'chat' | 'decision';

export interface AppEvent<T = any> {
  type: EventType;
  data: T;
  timestamp: string;
}

export class EventBus extends EventEmitter {
  constructor() {
    super();
    // Allow many concurrent SSE clients without MaxListenersExceeded warning
    this.setMaxListeners(100);
  }

  /**
   * Emits a typed event to direct listeners as well as generic app_event listeners.
   */
  emitEvent<T = any>(type: EventType, data: T): void {
    const timestamp = new Date().toISOString();
    const eventPayload: AppEvent<T> = { type, data, timestamp };

    // Emit event by its specific type
    this.emit(type, eventPayload);
    // Emit generic event for stream consumers
    this.emit('app_event', eventPayload);
  }

  /**
   * Subscribe to all app events. Returns an unsubscribe function.
   */
  onEvent(listener: (event: AppEvent) => void): () => void {
    this.on('app_event', listener);
    return () => {
      this.off('app_event', listener);
    };
  }
}

// Singleton EventBus instance
export const eventBus = new EventBus();

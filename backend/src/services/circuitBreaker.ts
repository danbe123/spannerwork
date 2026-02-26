/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by failing fast when a service is down.
 * Used to protect email providers from repeated failing requests.
 */

import { logger } from '../config/logger.js';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold: number;     // Number of failures before opening
  resetTimeout: number;          // Time in ms to wait before half-open
  halfOpenRequests: number;      // Number of test requests in half-open state
  successThreshold?: number;     // Successes needed to close (default: halfOpenRequests)
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private halfOpenRequests = 0;
  private lastFailure: Date | null = null;
  private lastSuccess: Date | null = null;
  private nextAttempt: number = 0;

  // Lifetime stats
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;

  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly halfOpenMaxRequests: number;
  private readonly successThreshold: number;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold;
    this.resetTimeout = options.resetTimeout;
    this.halfOpenMaxRequests = options.halfOpenRequests;
    this.successThreshold = options.successThreshold ?? options.halfOpenRequests;
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new CircuitOpenError(this.name, this.nextAttempt - Date.now());
    }

    this.totalRequests++;

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Check if the circuit allows execution
   */
  private canExecute(): boolean {
    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'OPEN') {
      if (Date.now() >= this.nextAttempt) {
        this.transitionTo('HALF_OPEN');
        return true;
      }
      return false;
    }

    // HALF_OPEN state - allow limited requests
    if (this.halfOpenRequests < this.halfOpenMaxRequests) {
      this.halfOpenRequests++;
      return true;
    }
    return false;
  }

  /**
   * Record a successful execution
   */
  private onSuccess(): void {
    this.lastSuccess = new Date();
    this.totalSuccesses++;

    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.transitionTo('CLOSED');
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success
      this.failures = 0;
    }
  }

  /**
   * Record a failed execution
   */
  private onFailure(): void {
    this.lastFailure = new Date();
    this.failures++;
    this.totalFailures++;

    if (this.state === 'HALF_OPEN') {
      // Any failure in half-open immediately opens the circuit
      this.transitionTo('OPEN');
    } else if (this.state === 'CLOSED' && this.failures >= this.failureThreshold) {
      this.transitionTo('OPEN');
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    logger.info(`Circuit breaker [${this.name}] state change: ${oldState} -> ${newState}`);

    switch (newState) {
      case 'OPEN':
        this.nextAttempt = Date.now() + this.resetTimeout;
        logger.warn(`Circuit breaker [${this.name}] OPENED. Will retry at ${new Date(this.nextAttempt).toISOString()}`);
        break;
      case 'HALF_OPEN':
        this.halfOpenRequests = 0;
        this.successes = 0;
        logger.info(`Circuit breaker [${this.name}] HALF_OPEN. Testing with ${this.halfOpenMaxRequests} requests.`);
        break;
      case 'CLOSED':
        this.failures = 0;
        this.successes = 0;
        logger.info(`Circuit breaker [${this.name}] CLOSED. Normal operation resumed.`);
        break;
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    // Check if we should transition from OPEN to HALF_OPEN
    if (this.state === 'OPEN' && Date.now() >= this.nextAttempt) {
      return 'HALF_OPEN';
    }
    return this.state;
  }

  /**
   * Get statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.getState(),
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * Force the circuit open (for testing or manual intervention)
   */
  forceOpen(): void {
    this.transitionTo('OPEN');
  }

  /**
   * Force the circuit closed (for testing or manual intervention)
   */
  forceClose(): void {
    this.transitionTo('CLOSED');
  }

  /**
   * Reset all state
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.halfOpenRequests = 0;
    this.lastFailure = null;
    this.lastSuccess = null;
    this.nextAttempt = 0;
    this.totalRequests = 0;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
    logger.info(`Circuit breaker [${this.name}] reset`);
  }
}

/**
 * Error thrown when circuit is open
 */
export class CircuitOpenError extends Error {
  public readonly circuitName: string;
  public readonly retryAfterMs: number;

  constructor(circuitName: string, retryAfterMs: number) {
    super(`Circuit breaker [${circuitName}] is open. Retry after ${Math.ceil(retryAfterMs / 1000)}s`);
    this.name = 'CircuitOpenError';
    this.circuitName = circuitName;
    this.retryAfterMs = retryAfterMs;
  }
}

// Pre-configured circuit breakers for email providers
export const mailtrapCircuit = new CircuitBreaker({
  name: 'mailtrap',
  failureThreshold: 5,
  resetTimeout: 30000,       // 30 seconds
  halfOpenRequests: 2,
  successThreshold: 2,
});

export const resendCircuit = new CircuitBreaker({
  name: 'resend',
  failureThreshold: 5,
  resetTimeout: 30000,
  halfOpenRequests: 2,
  successThreshold: 2,
});

/**
 * Get health status of all email provider circuits
 */
export function getEmailCircuitHealth() {
  return {
    mailtrap: mailtrapCircuit.getStats(),
    resend: resendCircuit.getStats(),
  };
}

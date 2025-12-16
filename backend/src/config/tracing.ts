/**
 * OpenTelemetry Tracing Configuration
 * 
 * Provides distributed tracing for the SpannerWork API.
 * Uses dynamic imports to avoid build failures when packages are not installed.
 * 
 * To enable:
 * 1. Install OpenTelemetry packages: npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-http
 * 2. Set OTEL_ENABLED=true in environment
 * 3. Set OTEL_EXPORTER_OTLP_ENDPOINT to your collector (e.g., http://localhost:4318)
 * 4. Optionally set OTEL_SERVICE_NAME (defaults to 'spannerwork-api')
 * 
 * Supported exporters:
 * - OTLP (default): Works with Jaeger, Grafana Tempo, etc.
 * - Console: For local debugging (set OTEL_EXPORTER=console)
 */

import { logger } from './logger.js';
import { trace } from '@opentelemetry/api';

// Configuration from environment
const OTEL_ENABLED = process.env.OTEL_ENABLED === 'true';
const OTEL_SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'spannerwork-api';
const OTEL_EXPORTER = process.env.OTEL_EXPORTER || 'otlp';
const OTEL_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

// SDK instance (dynamically loaded)
let sdk: unknown = null;

/**
 * Initialize OpenTelemetry tracing
 * Must be called before any other imports for full instrumentation
 * Uses dynamic imports to handle missing packages gracefully
 */
export async function initTracing(): Promise<void> {
  if (!OTEL_ENABLED) {
    logger.info('OpenTelemetry tracing is disabled (set OTEL_ENABLED=true to enable)');
    return;
  }

  try {
    // Dynamic imports to avoid build failures when packages aren't installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ConsoleSpanExporter } = require('@opentelemetry/sdk-trace-base');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Resource } = require('@opentelemetry/resources');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const semconv = require('@opentelemetry/semantic-conventions');
    
    const SEMRESOURCEATTRVALS_SERVICE_NAME = semconv.ATTR_SERVICE_NAME || semconv.SEMRESATTRS_SERVICE_NAME || 'service.name';
    const SEMRESOURCEATTRVALS_SERVICE_VERSION = semconv.ATTR_SERVICE_VERSION || semconv.SEMRESATTRS_SERVICE_VERSION || 'service.version';
    const SEMRESOURCEATTRVALS_DEPLOYMENT_ENVIRONMENT = semconv.ATTR_DEPLOYMENT_ENVIRONMENT || semconv.SEMRESATTRS_DEPLOYMENT_ENVIRONMENT || 'deployment.environment';

    // Choose exporter based on configuration
    const exporter = OTEL_EXPORTER === 'console'
      ? new ConsoleSpanExporter()
      : new OTLPTraceExporter({
          url: `${OTEL_ENDPOINT}/v1/traces`,
        });

    // Create SDK with auto-instrumentation
    sdk = new NodeSDK({
      resource: new Resource({
        [SEMRESOURCEATTRVALS_SERVICE_NAME]: OTEL_SERVICE_NAME,
        [SEMRESOURCEATTRVALS_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
        [SEMRESOURCEATTRVALS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
      }),
      traceExporter: exporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable file system instrumentation (too noisy)
          '@opentelemetry/instrumentation-fs': { enabled: false },
          // Configure HTTP instrumentation
          '@opentelemetry/instrumentation-http': {
            ignoreIncomingPaths: ['/health', '/metrics'],
          },
          // Configure Express instrumentation
          '@opentelemetry/instrumentation-express': {
            enabled: true,
          },
        }),
      ],
    });

    // Start the SDK
    await (sdk as { start: () => Promise<void> }).start();

    logger.info(`OpenTelemetry tracing initialized`, {
      serviceName: OTEL_SERVICE_NAME,
      exporter: OTEL_EXPORTER,
      endpoint: OTEL_EXPORTER === 'otlp' ? OTEL_ENDPOINT : 'console',
    });
  } catch (error) {
    logger.warn('OpenTelemetry packages not installed or failed to initialize. Tracing disabled.', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      hint: 'Run: npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-http'
    });
  }
}

/**
 * Gracefully shutdown tracing
 */
export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    try {
      await (sdk as { shutdown: () => Promise<void> }).shutdown();
      logger.info('OpenTelemetry tracing shut down');
    } catch (error) {
      logger.error('Error shutting down OpenTelemetry:', error);
    }
  }
}

/**
 * Get the current trace ID for logging
 */
export function getCurrentTraceId(): string | undefined {
  try {
    const span = trace.getActiveSpan();
    if (span) {
      return span.spanContext().traceId;
    }
  } catch {
    // OpenTelemetry not available
  }
  return undefined;
}

/**
 * Create a custom span for business operations
 */
export function createSpan(name: string, fn: () => Promise<void>): Promise<void> {
  if (!OTEL_ENABLED) {
    return fn();
  }

  try {
    const tracer = trace.getTracer(OTEL_SERVICE_NAME);
    
    return tracer.startActiveSpan(name, async (span: { end: () => void }) => {
      try {
        await fn();
      } finally {
        span.end();
      }
    });
  } catch {
    return fn();
  }
}

export default {
  initTracing,
  shutdownTracing,
  getCurrentTraceId,
  createSpan,
};

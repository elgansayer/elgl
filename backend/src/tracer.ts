import tracer from 'dd-trace';

const isProduction = process.env.NODE_ENV === 'production';

tracer.init({
  apmTracingEnabled: isProduction,
  logInjection: true,
  profiling: isProduction,
  env: process.env.DD_ENV ?? 'development',
  service: process.env.DD_SERVICE ?? 'hellotalk-backend',
  version: process.env.DD_VERSION ?? '0.0.1',
  runtimeMetrics: {
    enabled: true,
  },
  dogstatsd: {
    hostname: process.env.DD_AGENT_HOST || 'localhost',
    port: parseInt(process.env.DD_DOGSTATSD_PORT || '8125', 10),
  },
});

export default tracer;
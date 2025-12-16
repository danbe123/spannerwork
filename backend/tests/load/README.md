# Load Testing

This directory contains k6 load tests for SpannerWork API endpoints.

## Prerequisites

Install k6:

```bash
# macOS
brew install k6

# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows (Chocolatey)
choco install k6

# Docker
docker pull grafana/k6
```

## Test Scenarios

### 1. Authentication (`auth.js`)
Tests login, registration, and token refresh under load.

```bash
k6 run tests/load/scenarios/auth.js
```

### 2. Listings (`listings.js`)
Tests browsing tools, spaces, requests, and geo queries.

```bash
k6 run tests/load/scenarios/listings.js
```

### 3. Booking Flow (`booking.js`)
Tests the complete booking transaction flow.

```bash
k6 run tests/load/scenarios/booking.js
```

## Running Tests

### Basic Run
```bash
# Run from backend directory
cd backend
k6 run tests/load/scenarios/auth.js
```

### Custom Virtual Users
```bash
k6 run --vus 50 --duration 5m tests/load/scenarios/listings.js
```

### Against Different Environment
```bash
k6 run -e BASE_URL=https://staging.spannerwork.com tests/load/scenarios/auth.js
```

### Output to JSON
```bash
k6 run --out json=results.json tests/load/scenarios/auth.js
```

### Output to InfluxDB (for Grafana dashboards)
```bash
k6 run --out influxdb=http://localhost:8086/k6 tests/load/scenarios/auth.js
```

## Test Profiles

Each scenario supports multiple load profiles defined in `k6.config.js`:

| Profile | Description | Use Case |
|---------|-------------|----------|
| `smokeTest` | 1 VU, 30s | Verify system works |
| `loadTest` | Ramp to 20 VUs | Normal expected load |
| `stressTest` | Ramp to 100 VUs | Beyond normal capacity |
| `spikeTest` | Sudden 100 VUs | Traffic surge handling |
| `soakTest` | 30 VUs for 30min | Memory leak detection |

To use a different profile, modify the scenario's `options` export.

## Thresholds

Default thresholds (tests fail if exceeded):

- **p(95) < 500ms**: 95% of requests under 500ms
- **error rate < 1%**: Less than 1% of requests fail
- **p(99) < 1.5s**: 99% of requests under 1.5 seconds

## Custom Metrics

Each scenario tracks custom metrics:

### Auth
- `login_success`: Login success rate
- `register_success`: Registration success rate
- `login_duration`: Login response time

### Listings
- `browse_success`: Browse success rate
- `geo_query_success`: Geo query success rate
- `geo_query_duration`: Geo query response time

### Booking
- `booking_flow_success`: Full flow success rate
- `booking_conflicts`: Count of booking conflicts

## CI/CD Integration

Add to your CI pipeline:

```yaml
load-test:
  stage: test
  image: grafana/k6
  script:
    - k6 run --out json=results.json tests/load/scenarios/auth.js
    - k6 run --out json=results.json tests/load/scenarios/listings.js
  artifacts:
    paths:
      - results.json
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
```

## Interpreting Results

```
     checks.........................: 95.00% ✓ 950  ✗ 50
     data_received..................: 2.5 MB 42 kB/s
     data_sent......................: 1.2 MB 20 kB/s
     http_req_duration..............: avg=245ms min=12ms max=1.2s p(90)=400ms p(95)=500ms
     http_reqs......................: 1000   16.67/s
```

- **checks**: Percentage of assertions that passed
- **http_req_duration**: Response time percentiles
- **http_reqs**: Total requests and rate per second

## Best Practices

1. **Run against staging**, not production
2. **Start with smoke tests** before load tests
3. **Monitor server resources** during tests (CPU, memory, DB connections)
4. **Run tests during off-peak hours** if testing production-like environments
5. **Compare results over time** to detect performance regressions

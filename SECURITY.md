# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in SpannerWork, please report it by emailing security@spannerwork.com. Do not open a public issue.

We will respond within 48 hours and work with you to understand and resolve the issue.

---

## Current Vulnerability Status

**Last Audited**: 9 December 2024

### Known Development Dependencies

| Package | Severity | Scope | Status |
|---------|----------|-------|--------|
| esbuild (via vitest) | Moderate | Dev only | Awaiting upstream fix |

#### Details: esbuild vulnerability (GHSA-67mh-4wv8-2f99)

- **Advisory**: https://github.com/advisories/GHSA-67mh-4wv8-2f99
- **Affected packages**: `vitest`, `vite-node` (development dependencies)
- **Production impact**: None - these packages are not included in production builds
- **Risk**: Allows malicious websites to send requests to local dev server if visited while `npm run dev` or `npm run test` is running
- **Mitigation**: Avoid visiting untrusted websites while running development server
- **Fix available**: No - waiting for upstream patch

### Production Dependencies

✅ No known vulnerabilities in production dependencies.

---

## Security Practices

### Authentication & Sessions

- [x] Passwords hashed with bcrypt (configurable salt rounds)
- [x] Password history tracking (prevents reuse of last 5 passwords)
- [x] Session rotation on login (prevents session fixation)
- [x] Session rotation on privilege escalation (email verification)
- [x] Account lockout after failed login attempts
- [x] Timing-safe comparisons for verification codes
- [x] Password reset tokens hashed before storage (SHA-256)

### Cookies

- [x] `HttpOnly` flag on session cookies
- [x] `Secure` flag in production
- [x] `SameSite=Strict` in production
- [x] `__Host-` prefix in production (enhanced security)
- [x] Session expiry aligned between cookie and server

### API Security

- [x] CSRF protection on state-changing endpoints
- [x] Rate limiting with Redis backend
- [x] Request ID tracking for distributed tracing
- [x] Input validation with Zod
- [x] Helmet security headers
- [x] CORS configured per environment
- [x] Request timeout middleware

### Data Protection

- [x] No sensitive data in error responses (production)
- [x] Password hash never sent to client
- [x] Email enumeration prevention on password reset
- [x] Soft delete with recovery for uploaded files

### Infrastructure

- [x] HTTPS redirect in production
- [x] HSTS enabled (1 year, includeSubDomains, preload)
- [x] Content Security Policy configured
- [x] Trust proxy configured for load balancer

---

## Audit Commands

```bash
# Check for vulnerabilities
npm audit

# Check backend dependencies
cd backend && npm audit

# Auto-fix where possible
npm audit fix
```

---

## Update Log

| Date | Action |
|------|--------|
| 2024-12-09 | Initial security audit documented |
| 2024-12-09 | Noted esbuild dev dependency vulnerability (moderate, no fix available) |

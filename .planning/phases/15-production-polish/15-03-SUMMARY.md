---
phase: 15-production-polish
plan: 03
subsystem: infra
tags: [sentry, crash-reporting, error-monitoring, expo]

# Dependency graph
requires:
  - phase: 15-02
    provides: Environment configuration with sentryDsn support
provides:
  - Sentry SDK integration for crash reporting
  - Automatic sourcemap upload configuration for EAS Build
  - Environment-aware error monitoring (preview/production only)
affects: [production-deployment, debugging, error-visibility]

# Tech tracking
tech-stack:
  added: ["@sentry/react-native ~7.2.0"]
  patterns: ["environment-conditional initialization", "Sentry.wrap() HOC pattern"]

key-files:
  modified:
    - package.json
    - app.json
    - app/_layout.tsx

key-decisions:
  - "[sentry-01] Sentry only initializes when sentryDsn is configured AND not in development"
  - "[sentry-02] Trace sampling: 20% in production, 100% in preview for debugging"
  - "[sentry-03] Sentry.wrap() applied to root component for error boundary integration"

patterns-established:
  - "Sentry initialization at module top-level before any component code"
  - "Environment-conditional SDK initialization pattern"

# Metrics
duration: 5min
completed: 2026-02-07
---

# Phase 15 Plan 03: Sentry Crash Reporting Summary

**Sentry React Native SDK integrated with environment-aware initialization and EAS sourcemap upload configuration**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-07T04:15:00Z
- **Completed:** 2026-02-07T04:20:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Installed @sentry/react-native SDK compatible with Expo 54
- Configured Sentry Expo plugin for automatic sourcemap uploads during EAS Build
- Integrated Sentry initialization in root layout with environment-aware activation
- Development builds excluded from Sentry reporting to avoid noise

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Sentry dependencies** - `ae7d849` (chore)
2. **Task 2: Configure Sentry plugin in app.json** - `e51124d` (feat)
3. **Task 3: Initialize Sentry in root layout** - `4b2569e` (feat)

## Files Created/Modified

- `package.json` - Added @sentry/react-native ~7.2.0 dependency
- `app.json` - Added @sentry/react-native/expo plugin with organization/project config
- `app/_layout.tsx` - Added Sentry import, initialization, and Sentry.wrap() HOC

## Decisions Made

1. **[sentry-01] Dual condition for Sentry activation** - Sentry.init() only runs when both `config.sentryDsn` is set AND `!isDevelopment()`. This ensures no crash reporting overhead in development.

2. **[sentry-02] Differentiated trace sampling** - Production uses 20% trace sampling to limit costs while preview uses 100% for full debugging visibility.

3. **[sentry-03] Sentry.wrap() HOC pattern** - Root component wrapped with Sentry.wrap() to enable error boundary integration and automatic error capture across the component tree.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - the npm installation showed some peer dependency warnings from @clerk packages regarding React 19, but these are pre-existing and unrelated to Sentry.

## User Setup Required

**External service requires configuration for full functionality:**

1. **Sentry Project Setup:**
   - Create Sentry project at sentry.io with organization: `ranz`, project: `ranz-mobile`
   - Obtain the DSN from Project Settings > Client Keys

2. **Environment Variables:**
   Add to EAS secrets for preview/production builds:
   ```bash
   eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value "https://xxx@xxx.ingest.sentry.io/xxx" --scope project
   ```

3. **Sourcemap Upload Auth:**
   For EAS Build to upload sourcemaps, add Sentry auth token:
   ```bash
   eas secret:create --name SENTRY_AUTH_TOKEN --value "your-sentry-auth-token" --scope project
   ```

4. **Verification:**
   After deployment, trigger a test error and verify it appears in Sentry dashboard.

## Next Phase Readiness

- Sentry integration complete and ready for preview/production deployment
- Sourcemaps will be automatically uploaded during EAS Build when secrets are configured
- Error boundary (existing ErrorBoundary component) will be enhanced to report to Sentry in a future iteration if needed

---
*Phase: 15-production-polish*
*Completed: 2026-02-07*

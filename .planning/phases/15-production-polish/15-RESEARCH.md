# Phase 15: Production Polish - Research

**Researched:** 2026-02-07
**Domain:** Expo React Native production deployment
**Confidence:** HIGH

## Summary

This research covers what's needed to make the RANZ Roofing Report mobile app production-ready. The app is built on Expo SDK 54 with a comprehensive feature set already in place including camera capture, GPS tracking, offline sync, and report integration. The codebase demonstrates solid foundations with existing error handling, logging infrastructure, and sync services.

The primary production gaps are: **placeholder app icons/splash screens** that need actual RANZ branding, **no crash reporting service** for production monitoring, **no EAS Build configuration** for app store builds, **no automated testing**, and **missing production environment separation**. The app has good internal error handling but lacks external crash reporting integration.

**Primary recommendation:** Focus on EAS Build setup with proper environment configuration first, then add Sentry for crash reporting, create branded assets, and establish basic testing infrastructure.

## Current State Summary

### What Exists (HIGH confidence - verified from codebase)

| Component | Status | Notes |
|-----------|--------|-------|
| Error Boundary | Complete | `ErrorBoundary.tsx`, `ScreenErrorBoundary` with retry UI |
| Error Handler | Complete | `error-handler.ts` with classification, user messages, validation |
| Logger Service | Complete | `logger.ts` with levels, sanitization, multiple sources |
| Sync Service | Complete | Full bidirectional sync with retry, exponential backoff |
| Background Sync | Complete | Expo Background Task integration |
| Auth | Complete | Clerk integration, biometrics, offline JWT verification |
| Permissions | Complete | Camera, location permissions with proper iOS/Android handling |
| Environment Config | Partial | `.env` and `.env.example` exist, only dev/prod |
| App Icons | Placeholder | Expo default concentric circles template |
| Splash Screen | Configured | Uses `#2d5c8f` background but placeholder icon |
| Testing | None | No test files found |
| EAS Build | Not configured | No `eas.json` file |

### Dependencies (from package.json)

| Category | Package | Version | Notes |
|----------|---------|---------|-------|
| Framework | expo | ~54.0.32 | Latest SDK |
| Navigation | expo-router | ^6.0.22 | File-based routing |
| State | zustand | ^5.0.10 | Lightweight state |
| Database | expo-sqlite | ^16.0.10 | Local storage |
| Auth | @clerk/clerk-expo | ^2.19.19 | SSO with web platform |
| Upload | tus-js-client | ^4.3.1 | Resumable uploads |
| HTTP | axios | ^1.13.2 | API client |

## Standard Stack

### Production Monitoring

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @sentry/react-native | ^6.x | Crash reporting, performance monitoring | Official Expo integration, sourcemaps support |
| sentry-expo | ^8.x | Expo-specific config plugin | Simplifies EAS Build integration |

**Note:** There is a known compatibility issue with Expo 54.0.0-preview.8 and @sentry/react-native@6.20.0. Verify current compatibility before installation.

### Testing

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jest | ^29.x | Unit testing runner | All unit tests |
| jest-expo | ^52.x | Expo-specific Jest preset | Mocks native modules |
| @testing-library/react-native | ^12.x | Component testing | UI component tests |
| detox | ^20.x | E2E testing | Critical flow validation |

### Build Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| EAS Build | Cloud builds for iOS/Android | All production builds |
| EAS Submit | App store submission | Production releases |
| Expo Atlas | Bundle analysis | Performance optimization |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sentry | Datadog | Higher cost, more features; Sentry has better Expo integration |
| Sentry | BugSnag | Similar features, less community adoption in RN |
| Detox | Appium | Appium more cross-platform but harder setup |

**Installation:**
```bash
# Monitoring
npx expo install @sentry/react-native sentry-expo

# Testing
npm install --save-dev jest jest-expo @testing-library/react-native
```

## Architecture Patterns

### Recommended Project Structure

The codebase already follows good patterns. For production polish, add:

```
ranz-mobile/
├── app/                  # Expo Router pages (existing)
├── src/
│   ├── __tests__/       # ADD: Unit tests mirror src structure
│   ├── components/      # (existing)
│   ├── services/        # (existing)
│   └── ...
├── e2e/                 # ADD: Detox E2E tests
│   ├── capture.test.js
│   └── sync.test.js
├── assets/
│   ├── icon.png         # REPLACE: 1024x1024 RANZ logo
│   ├── adaptive-icon.png # REPLACE: Android adaptive icon
│   └── splash-icon.png  # REPLACE: RANZ splash logo
├── eas.json             # ADD: EAS Build configuration
└── sentry.config.js     # ADD: Sentry configuration
```

### Pattern 1: Environment-Based Configuration

**What:** Separate configs for development, staging, and production
**When to use:** All deployments

**Example:**
```typescript
// src/config/environment.ts
const environments = {
  development: {
    apiUrl: 'http://localhost:3000',
    sentryDsn: '', // Disabled in dev
    enableLogs: true,
  },
  preview: {
    apiUrl: 'https://staging.reports.ranz.org.nz',
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    enableLogs: true,
  },
  production: {
    apiUrl: 'https://reports.ranz.org.nz',
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    enableLogs: false,
  },
};

const currentEnv = process.env.EXPO_PUBLIC_APP_ENV || 'development';
export const config = environments[currentEnv];
```

### Pattern 2: EAS Build Profiles

**What:** Separate build configurations per environment
**When to use:** All builds

**Example eas.json:**
```json
{
  "cli": {
    "version": ">= 15.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      },
      "env": {
        "EXPO_PUBLIC_APP_ENV": "development"
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      },
      "env": {
        "EXPO_PUBLIC_APP_ENV": "preview"
      }
    },
    "production": {
      "distribution": "store",
      "autoIncrement": true,
      "env": {
        "EXPO_PUBLIC_APP_ENV": "production"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "developer@ranz.org.nz",
        "ascAppId": "YOUR_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

### Pattern 3: Sentry Integration

**What:** Crash reporting with sourcemaps
**When to use:** All production builds

**Example:**
```typescript
// App.tsx or _layout.tsx
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: process.env.EXPO_PUBLIC_APP_ENV || 'development',
  enabled: process.env.EXPO_PUBLIC_APP_ENV !== 'development',
  tracesSampleRate: 1.0,
  attachScreenshot: true,
  attachViewHierarchy: true,
});

// Wrap root component
export default Sentry.wrap(RootLayout);
```

### Anti-Patterns to Avoid

- **Hardcoding API URLs:** Use environment variables via EXPO_PUBLIC_ prefix
- **Storing secrets in code:** The JWT public key embedding is acceptable (it's public), but API keys should never be in code
- **Disabling Hermes:** Expo 54 uses Hermes by default; keep it enabled for performance
- **Skipping version management:** Use `autoIncrement` in eas.json for build numbers

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Crash reporting | Custom error logging to API | Sentry | Sourcemaps, stack traces, session replay |
| App icons | Manual resizing | EAS Build auto-generation | 1024x1024 source auto-scales to all sizes |
| Bundle analysis | Manual inspection | Expo Atlas | Visual dependency tree, size breakdown |
| Environment vars | Custom config loading | EXPO_PUBLIC_ prefix | Built into Metro bundler |
| App signing | Manual keystore management | EAS credentials | Secure storage, team sharing |
| OTA updates | Custom update server | EAS Update | Version pinning, rollback, analytics |

**Key insight:** Expo/EAS provides comprehensive tooling for all production deployment concerns. Custom solutions add maintenance burden without benefits.

## Common Pitfalls

### Pitfall 1: Missing Sentry Sourcemaps

**What goes wrong:** Crash reports show minified code, unusable for debugging
**Why it happens:** Sentry needs sourcemaps uploaded during build
**How to avoid:**
- Add `expo-sentry` config plugin in app.json
- Set `SENTRY_AUTH_TOKEN` in EAS secrets
- Verify sourcemaps in Sentry dashboard after first build
**Warning signs:** Stack traces show bundle.js line numbers without function names

### Pitfall 2: Placeholder Icons in Production

**What goes wrong:** App rejected from app stores, looks unprofessional
**Why it happens:** Forgot to replace Expo template icons
**How to avoid:**
- Create branded icons BEFORE first store submission
- iOS requires 1024x1024 with no transparency
- Android adaptive icon needs foreground and background layers
**Warning signs:** Icon is concentric circles or generic shape

### Pitfall 3: Environment Variable Leakage

**What goes wrong:** Development URLs in production builds
**Why it happens:** Wrong .env file or missing EAS env config
**How to avoid:**
- Set environment variables in EAS dashboard, not just .env files
- Use `EXPO_PUBLIC_APP_ENV` to verify environment at runtime
- Log current environment on app startup (dev only)
**Warning signs:** API calls go to localhost or staging in production

### Pitfall 4: Build Number Conflicts

**What goes wrong:** App store rejects build with existing version
**Why it happens:** Manual version management, forgot to increment
**How to avoid:**
- Use `autoIncrement: true` in eas.json production profile
- Let EAS manage build numbers automatically
**Warning signs:** "Build already exists" errors during submission

### Pitfall 5: Large Bundle Size

**What goes wrong:** Slow app startup, large download size
**Why it happens:** Unused dependencies, large assets bundled
**How to avoid:**
- Run Expo Atlas to analyze bundle
- Audit package.json for unused dependencies
- Use `expo-asset` for lazy loading large assets
**Warning signs:** TTI > 3 seconds on mid-range devices

## Code Examples

### EAS Build Configuration

```json
// eas.json - Complete production configuration
{
  "cli": {
    "version": ">= 15.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      },
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_PUBLIC_APP_ENV": "development",
        "EXPO_PUBLIC_API_URL": "http://localhost:3000"
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "resourceClass": "m-medium"
      },
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_PUBLIC_APP_ENV": "preview"
      }
    },
    "production": {
      "distribution": "store",
      "autoIncrement": "buildNumber",
      "ios": {
        "resourceClass": "m-medium"
      },
      "android": {
        "buildType": "app-bundle"
      },
      "env": {
        "EXPO_PUBLIC_APP_ENV": "production"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### Sentry app.json Plugin Configuration

```json
// Add to app.json plugins array
{
  "expo": {
    "plugins": [
      // ... existing plugins
      [
        "@sentry/react-native/expo",
        {
          "organization": "ranz",
          "project": "ranz-mobile",
          "url": "https://sentry.io/"
        }
      ]
    ]
  }
}
```

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|sentry-expo)',
  ],
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};
```

### Basic Component Test

```typescript
// src/__tests__/components/SyncStatus.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SyncStatus } from '../../components/SyncStatus';

describe('SyncStatus', () => {
  it('shows online indicator when connected', () => {
    render(<SyncStatus isOnline={true} pendingCount={0} />);
    expect(screen.getByText('Synced')).toBeTruthy();
  });

  it('shows pending count when items waiting', () => {
    render(<SyncStatus isOnline={true} pendingCount={5} />);
    expect(screen.getByText('5 pending')).toBeTruthy();
  });

  it('shows offline indicator when disconnected', () => {
    render(<SyncStatus isOnline={false} pendingCount={0} />);
    expect(screen.getByText('Offline')).toBeTruthy();
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| expo build | EAS Build | 2021 | Cloud builds, team credentials |
| Manual icon scaling | Auto-generation from 1024x1024 | Expo SDK 50+ | Single source icon |
| .env files only | EAS Environment Variables | 2024 | Secure secret management |
| Classic builds | New Architecture (Fabric) | SDK 52+ | 83% adoption, better performance |
| Manual upload | EAS Submit | 2021 | Automated store submission |

**Deprecated/outdated:**
- `expo build:ios/android`: Use EAS Build instead
- Manual APK signing: Use EAS credentials management
- AsyncStorage for secrets: Use expo-secure-store

## Gap Analysis

### Critical Gaps (Must fix before production)

| Gap | Risk | Effort | Priority |
|-----|------|--------|----------|
| No EAS Build config | Cannot build for stores | Low | P0 |
| Placeholder icons | App store rejection | Low | P0 |
| No crash reporting | Blind to production issues | Medium | P0 |
| No version management | Build conflicts | Low | P0 |

### Important Gaps (Should fix)

| Gap | Risk | Effort | Priority |
|-----|------|--------|----------|
| No automated tests | Regressions undetected | High | P1 |
| Single environment | Config errors in prod | Medium | P1 |
| No bundle analysis | Slow startup possible | Low | P1 |
| No README | Onboarding difficulty | Low | P1 |

### Nice-to-Have

| Gap | Benefit | Effort | Priority |
|-----|---------|--------|----------|
| E2E tests | Critical flow validation | High | P2 |
| OTA updates | Fast bug fixes | Medium | P2 |
| Performance profiling | Optimization data | Medium | P2 |

## Risk Assessment

### High Risk Items

1. **Xcode 26 Requirement (April 2026)**: Apple requires Xcode 26 for all submissions. EAS Build defaults to Xcode 26 for SDK 54 projects, so this should be handled automatically.

2. **Sentry Compatibility**: Known issues with Expo 54 preview versions. Verify compatibility with current stable before adding.

3. **App Store Review**: First submission may face additional scrutiny. Plan for 1-2 week review time.

### Medium Risk Items

1. **Bundle Size**: Current dependency count is reasonable but should be verified with Expo Atlas before production.

2. **Background Sync Reliability**: Already implemented but untested in production conditions.

### Low Risk Items

1. **Icon Generation**: Straightforward replacement of placeholder files.

2. **Environment Configuration**: Existing pattern is close to best practice.

## Recommended Implementation Order

### Wave 1: Build Infrastructure (Critical Path)
1. Create eas.json with all build profiles
2. Configure EAS credentials (iOS certs, Android keystore)
3. Replace placeholder icons with RANZ branding
4. Test preview build internally

### Wave 2: Production Monitoring
1. Add Sentry with sourcemap configuration
2. Integrate Sentry.wrap in root layout
3. Test error reporting in preview build
4. Configure Sentry alerts

### Wave 3: Environment & Polish
1. Create proper environment configuration
2. Add jest and basic unit tests for critical paths
3. Create README with setup instructions
4. Run Expo Atlas for bundle analysis

### Wave 4: Store Preparation
1. Prepare App Store Connect listing
2. Prepare Google Play Console listing
3. Create store screenshots and descriptions
4. Submit for review

## Open Questions

1. **RANZ Brand Assets**
   - What we know: App needs 1024x1024 icon PNG
   - What's unclear: Do final brand assets exist? Who provides them?
   - Recommendation: Request assets from RANZ marketing/design

2. **Apple Developer Account**
   - What we know: Required for iOS builds and submission
   - What's unclear: Does RANZ have existing Apple Developer membership?
   - Recommendation: Verify account status before build configuration

3. **Sentry Account**
   - What we know: Sentry provides free tier for small projects
   - What's unclear: Should use existing RANZ Sentry org or new project?
   - Recommendation: Decide on monitoring strategy across all RANZ apps

4. **Test Device Matrix**
   - What we know: App targets iOS and Android
   - What's unclear: Minimum OS versions, specific device testing requirements
   - Recommendation: Define supported device/OS matrix

## Sources

### Primary (HIGH confidence)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/) - Build profiles, configuration
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/) - Store submission process
- [Expo SDK 54 Changelog](https://expo.dev/changelog/sdk-54) - SDK features, precompiled builds
- [Using Sentry - Expo Documentation](https://docs.expo.dev/guides/using-sentry/) - Sentry integration guide
- [Splash screen and app icon - Expo Documentation](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/) - Asset requirements
- [Environment variables in Expo](https://docs.expo.dev/guides/environment-variables/) - EXPO_PUBLIC_ prefix usage

### Secondary (MEDIUM confidence)
- [Unit testing with Jest - Expo Documentation](https://docs.expo.dev/develop/unit-testing/) - jest-expo preset
- [Expo Atlas blog post](https://www.callstack.com/blog/knowing-your-apps-bundle-contents-native-performance) - Bundle analysis

### Tertiary (LOW confidence - validate before using)
- [Sentry Expo 54 compatibility issue](https://github.com/getsentry/sentry-react-native/issues/5103) - GitHub issue discussing compatibility

## Metadata

**Confidence breakdown:**
- EAS Build configuration: HIGH - Official Expo documentation
- Sentry integration: MEDIUM - Known compatibility issues with Expo 54
- Testing setup: HIGH - Standard React Native testing patterns
- Icon requirements: HIGH - Apple/Google store requirements well documented

**Research date:** 2026-02-07
**Valid until:** 2026-03-07 (30 days - stable technologies)

---

## Appendix: Current App Configuration

### app.json Analysis

The current app.json includes:
- Bundle identifiers: `nz.ranz.mobile` (both platforms)
- Scheme: `ranz` (for deep linking)
- New Architecture: enabled
- Typed routes: enabled
- Required permissions configured correctly

**Missing:**
- EAS projectId placeholder: `"your-project-id"` needs real value
- Sentry config plugin

### Environment Variables (.env.example)

Current variables:
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_API_URL`

**Needed additions:**
- `EXPO_PUBLIC_APP_ENV`
- `EXPO_PUBLIC_SENTRY_DSN`

# Phase 12: Photo Management - Research

**Researched:** 2026-02-07
**Domain:** React Native photo gallery, annotation, organization, and evidence integrity
**Confidence:** HIGH

## Summary

Phase 12 builds upon a substantial existing codebase that already handles photo capture (Phase 11), basic annotation (PhotoAnnotator), and evidence integrity (hash verification, chain of custody). The phase focuses on creating a cohesive photo management experience: gallery viewing, organization/filtering, enhanced annotation workflows, and thumbnail generation.

The existing implementation uses:
- `react-native-svg` for vector annotations
- `react-native-view-shot` for capturing annotated images
- `expo-crypto` for SHA-256 hashing
- SQLite for local photo metadata storage
- Immutable originals with working copies pattern (evidence-safe)

**Primary recommendation:** Extend existing PhotoGrid and PhotoDetailModal components with gallery features (full-screen viewer with zoom, SectionList grouping), add expo-image-manipulator for thumbnail generation, and ensure all annotation workflows preserve evidence integrity by only modifying working copies.

## Standard Stack

The existing project already has the core dependencies. Phase 12 should leverage these rather than introducing alternatives.

### Core (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-native-svg` | 15.12.1 | Vector annotation rendering | Already used in PhotoAnnotator, industry standard for React Native SVG |
| `react-native-view-shot` | 4.0.3 | Capture annotated images | Already used, proven for screenshot capture |
| `react-native-gesture-handler` | ~2.28.0 | Gesture recognition | Required by Expo, handles pinch/pan |
| `expo-file-system` | ^19.0.21 | File operations | Already used, handles originals/working copies |
| `expo-crypto` | ^15.0.8 | SHA-256 hashing | Already used for evidence integrity |

### Supporting (To Add)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-image-manipulator` | ~14.0.0 | Thumbnail generation, resizing | Generate thumbnails on capture/import |
| `@likashefqet/react-native-image-zoom` | ^3.0.0 | Pinch-to-zoom image viewer | Full-screen photo viewing with zoom/pan |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `expo-image-manipulator` | Native iOS/Android resize | More work but potentially faster for high-res images |
| `@likashefqet/react-native-image-zoom` | `react-native-zoom-toolkit` | Zoom-toolkit more features but larger bundle |
| Custom annotation | `react-native-svg-draw` | Pre-built but less control over forensic requirements |

**Installation:**
```bash
npx expo install expo-image-manipulator @likashefqet/react-native-image-zoom
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   ├── PhotoGallery/           # New: Full gallery experience
│   │   ├── PhotoGalleryScreen.tsx    # Full-screen gallery with tabs
│   │   ├── PhotoGalleryGrid.tsx      # Grid view with filtering
│   │   ├── PhotoGalleryList.tsx      # SectionList by date/element/tag
│   │   └── PhotoFullScreenViewer.tsx # Zoom viewer with swipe navigation
│   ├── PhotoGrid.tsx           # Existing: 2-column grid (enhance)
│   ├── PhotoDetailModal.tsx    # Existing: Photo details (enhance)
│   ├── PhotoAnnotator.tsx      # Existing: Annotation tool (enhance)
│   └── PhotoAnnotationScreen.tsx # Existing: Annotation wrapper
├── services/
│   ├── photo-service.ts        # Existing: Capture, storage
│   ├── annotation-service.ts   # Existing: Annotation persistence
│   ├── thumbnail-service.ts    # New: Thumbnail generation
│   └── evidence-service.ts     # Existing: Hash verification
├── hooks/
│   ├── usePhotoAnnotations.ts  # Existing: Annotation state
│   ├── usePhotoGallery.ts      # New: Gallery state & filtering
│   └── useThumbnails.ts        # New: Thumbnail loading/caching
└── types/
    ├── database.ts             # Existing: LocalPhoto type
    └── shared.ts               # Existing: PhotoType, QuickTag enums
```

### Pattern 1: Layered Photo Storage (Evidence-Safe)

**What:** Three-tier storage for forensic integrity
**When to use:** All photo operations

```
evidence/
├── originals/      # IMMUTABLE - Hash verified, never modified
│   └── orig_photo_123.jpg
├── photos/         # WORKING COPY - May have EXIF edits
│   └── photo_123.jpg
├── thumbnails/     # DERIVED - Regeneratable
│   └── thumb_photo_123.jpg
└── annotations/    # RENDERED - Annotated versions
    └── annotated_photo_123_1707350400.jpg
```

**Evidence flow:**
1. Original captured -> hashed -> stored in `originals/` (NEVER touched again)
2. Working copy in `photos/` for display (may have embedded GPS EXIF)
3. Annotations rendered to `annotations/` (working copy + SVG overlay)
4. Thumbnails generated to `thumbnails/` (can be regenerated)
5. Verification always uses `originals/` file

### Pattern 2: Annotation on Working Copy Only

**What:** Annotations never touch original evidence
**When to use:** All annotation operations

```typescript
// Source: Existing annotation-service.ts pattern
async saveAnnotations(
  photoId: string,
  annotations: Annotation[],
  annotatedImageUri: string // ViewShot output of working copy + SVG
): Promise<SaveAnnotationResult> {
  // 1. Get photo details (for working copy path)
  const photo = await getPhotoById(photoId);

  // 2. Save annotations JSON to database
  const annotationsJson = JSON.stringify(annotations);

  // 3. Copy ViewShot output to annotations directory
  // NEVER modifies originals/ or working copy photos/
  const permanentUri = `${annotationsDir}annotated_${photoId}_${Date.now()}.jpg`;
  await copyAsync({ from: annotatedImageUri, to: permanentUri });

  // 4. Update database with annotation data and annotated URI
  await updatePhotoAnnotations(photoId, annotationsJson, permanentUri);

  // 5. Log to chain of custody
  await logCustodyEvent("ANNOTATED", "photo", photoId, ...);
}
```

### Pattern 3: Thumbnail Generation on Capture

**What:** Generate thumbnails at capture time to avoid runtime processing
**When to use:** Photo capture, photo import

```typescript
// New: thumbnail-service.ts pattern
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

async function generateThumbnail(
  sourceUri: string,
  photoId: string
): Promise<string> {
  const thumbnailPath = `${STORAGE_PATHS.thumbnails}thumb_${photoId}.jpg`;

  // Resize to 200px width, maintain aspect ratio
  const result = await manipulateAsync(
    sourceUri,
    [{ resize: { width: 200 } }],
    { compress: 0.7, format: SaveFormat.JPEG }
  );

  // Move to permanent location
  await moveAsync({ from: result.uri, to: thumbnailPath });

  return thumbnailPath;
}
```

### Pattern 4: SectionList for Grouped Photos

**What:** Group photos by date, element, tag, or defect
**When to use:** Gallery list views

```typescript
// Grouping photos by date
interface PhotoSection {
  title: string;           // "Today", "Yesterday", "7 Feb 2026"
  data: LocalPhoto[];
}

function groupPhotosByDate(photos: LocalPhoto[]): PhotoSection[] {
  const groups = new Map<string, LocalPhoto[]>();

  photos.forEach(photo => {
    const dateKey = formatDateGroup(photo.capturedAt);
    const existing = groups.get(dateKey) || [];
    groups.set(dateKey, [...existing, photo]);
  });

  return Array.from(groups.entries())
    .sort(([a], [b]) => compareDates(b, a)) // Newest first
    .map(([title, data]) => ({ title, data }));
}

// Usage in SectionList
<SectionList
  sections={groupPhotosByDate(photos)}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <PhotoItem photo={item} />}
  renderSectionHeader={({ section }) => (
    <SectionHeader title={section.title} count={section.data.length} />
  )}
  stickySectionHeadersEnabled
/>
```

### Pattern 5: Full-Screen Viewer with Zoom

**What:** Pinch-to-zoom photo viewer with swipe navigation
**When to use:** Viewing photo details, before/after annotation

```typescript
import ImageZoom from '@likashefqet/react-native-image-zoom';

function PhotoFullScreenViewer({
  photos,
  initialIndex,
  onClose
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  return (
    <Modal visible animationType="fade">
      <FlatList
        data={photos}
        horizontal
        pagingEnabled
        initialScrollIndex={initialIndex}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentIndex(index);
        }}
        renderItem={({ item }) => (
          <View style={{ width: SCREEN_WIDTH }}>
            <ImageZoom
              uri={item.localUri}
              minScale={1}
              maxScale={5}
              doubleTapScale={2}
            />
          </View>
        )}
      />
      <PhotoOverlay photo={photos[currentIndex]} onClose={onClose} />
    </Modal>
  );
}
```

### Anti-Patterns to Avoid

- **Modifying originals:** NEVER write to `originals/` directory after initial capture. This breaks evidence integrity.
- **In-memory annotations without persistence:** Annotations must be saved to database before user can navigate away.
- **Regenerating thumbnails on every load:** Generate once at capture, cache path in database.
- **Loading full-resolution images in grids:** Always use thumbnails for grid display.
- **Blocking UI for hash verification:** Run verification in background, show status indicator.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pinch-to-zoom | Custom gesture handler | `@likashefqet/react-native-image-zoom` | Complex gesture math, memory management for large images |
| Image resizing | Manual canvas operations | `expo-image-manipulator` | Native performance, handles EXIF rotation |
| SVG rendering | Canvas drawing | `react-native-svg` | Already installed, vector quality at any scale |
| Screenshot capture | Manual bitmap export | `react-native-view-shot` | Already installed, handles platform differences |
| Virtualized list | Custom recycler | `FlatList`/`SectionList` | Built-in, optimized, well-tested |

**Key insight:** The existing codebase already has the hard parts solved. Phase 12 is about composition and UX, not reimplementing core functionality.

## Common Pitfalls

### Pitfall 1: Memory Pressure from Large Images

**What goes wrong:** Loading multiple high-resolution photos causes app crashes on low-memory devices
**Why it happens:** iOS/Android have strict memory limits; a single 12MP photo can use 50MB+ when decoded
**How to avoid:**
- Always display thumbnails in grids
- Lazy-load full resolution only when viewing single photo
- Use `removeClippedSubviews={true}` on FlatList
- Consider `react-native-fast-image` if memory issues persist
**Warning signs:** App crashes during rapid scrolling, "Received memory warning" logs

### Pitfall 2: Losing Annotation State

**What goes wrong:** User annotates photo, navigates away, annotations lost
**Why it happens:** Annotations stored only in component state, not persisted
**How to avoid:**
- Use existing annotation-service.ts which persists to SQLite
- Save annotations immediately after each change (debounced)
- Show unsaved indicator if annotations differ from database
**Warning signs:** User complaints about lost work, annotations missing after app restart

### Pitfall 3: Slow Gallery Load with Many Photos

**What goes wrong:** Gallery takes 5+ seconds to load with 100+ photos
**Why it happens:** Loading all photo metadata and thumbnails synchronously
**How to avoid:**
- Use FlatList virtualization (already done in PhotoGrid)
- Lazy-load thumbnails as they scroll into view
- Implement `getItemLayout` for instant scroll
- Consider pagination for 500+ photos
**Warning signs:** Blank screen on gallery open, ANR warnings on Android

### Pitfall 4: Hash Mismatch After Annotation

**What goes wrong:** Evidence verification fails after annotation
**Why it happens:** Confusion between original and annotated file paths
**How to avoid:**
- Hash verification ALWAYS uses file from `originals/` directory
- Existing pattern: `getOriginalPath(photo.originalFilename)` for verification
- Annotated versions are separate files, not replacements
**Warning signs:** Integrity check failures, hash mismatches in court documents

### Pitfall 5: Annotation Quality Loss

**What goes wrong:** Annotations look blurry or pixelated when exported
**Why it happens:** ViewShot not accounting for device pixel ratio
**How to avoid:**
```typescript
// Use correct pixel ratio for crisp output
const pixelRatio = PixelRatio.get();
viewShotRef.capture({
  format: 'jpg',
  quality: 0.9,
  result: 'tmpfile',
  // Optionally: specify dimensions accounting for pixel ratio
});
```
**Warning signs:** Annotations look fine on screen but blurry in exported images

## Code Examples

### Example 1: Thumbnail Service

```typescript
// src/services/thumbnail-service.ts
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { getInfoAsync, moveAsync, deleteAsync } from 'expo-file-system/legacy';
import { STORAGE_PATHS } from '../lib/file-storage';

const THUMBNAIL_WIDTH = 200;
const THUMBNAIL_QUALITY = 0.7;

export async function generateThumbnail(
  sourceUri: string,
  photoId: string
): Promise<string> {
  const thumbnailFilename = `thumb_${photoId}.jpg`;
  const thumbnailPath = `${STORAGE_PATHS.thumbnails}${thumbnailFilename}`;

  try {
    // Check if thumbnail already exists
    const existing = await getInfoAsync(thumbnailPath);
    if (existing.exists) {
      return thumbnailPath;
    }

    // Generate thumbnail
    const result = await manipulateAsync(
      sourceUri,
      [{ resize: { width: THUMBNAIL_WIDTH } }],
      { compress: THUMBNAIL_QUALITY, format: SaveFormat.JPEG }
    );

    // Move to permanent location
    await moveAsync({ from: result.uri, to: thumbnailPath });

    return thumbnailPath;
  } catch (error) {
    console.error('[ThumbnailService] Failed to generate thumbnail:', error);
    // Fall back to source URI if thumbnail generation fails
    return sourceUri;
  }
}

export async function deleteThumbnail(photoId: string): Promise<void> {
  const thumbnailPath = `${STORAGE_PATHS.thumbnails}thumb_${photoId}.jpg`;
  await deleteAsync(thumbnailPath, { idempotent: true });
}
```

### Example 2: Photo Gallery Hook with Filtering

```typescript
// src/hooks/usePhotoGallery.ts
import { useState, useMemo, useCallback } from 'react';
import type { LocalPhoto } from '../types/database';
import type { PhotoType, QuickTag, ElementType } from '../types/shared';

interface PhotoFilters {
  photoType?: PhotoType;
  quickTag?: QuickTag;
  elementType?: ElementType;
  defectId?: string;
  roofElementId?: string;
  hasAnnotations?: boolean;
  dateRange?: { start: Date; end: Date };
}

interface GroupedPhotos {
  title: string;
  data: LocalPhoto[];
}

type GroupBy = 'date' | 'element' | 'tag' | 'defect' | 'none';

export function usePhotoGallery(
  allPhotos: LocalPhoto[],
  initialFilters?: PhotoFilters
) {
  const [filters, setFilters] = useState<PhotoFilters>(initialFilters || {});
  const [groupBy, setGroupBy] = useState<GroupBy>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Apply filters
  const filteredPhotos = useMemo(() => {
    return allPhotos.filter(photo => {
      if (filters.photoType && photo.photoType !== filters.photoType) return false;
      if (filters.quickTag && photo.quickTag !== filters.quickTag) return false;
      if (filters.defectId && photo.defectId !== filters.defectId) return false;
      if (filters.roofElementId && photo.roofElementId !== filters.roofElementId) return false;
      if (filters.hasAnnotations !== undefined) {
        const has = !!photo.annotationsJson && photo.annotationsJson !== '[]';
        if (filters.hasAnnotations !== has) return false;
      }
      return true;
    });
  }, [allPhotos, filters]);

  // Sort photos
  const sortedPhotos = useMemo(() => {
    return [...filteredPhotos].sort((a, b) => {
      const dateA = new Date(a.capturedAt || a.createdAt).getTime();
      const dateB = new Date(b.capturedAt || b.createdAt).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [filteredPhotos, sortOrder]);

  // Group photos
  const groupedPhotos = useMemo((): GroupedPhotos[] => {
    if (groupBy === 'none') {
      return [{ title: 'All Photos', data: sortedPhotos }];
    }

    const groups = new Map<string, LocalPhoto[]>();

    sortedPhotos.forEach(photo => {
      let key: string;
      switch (groupBy) {
        case 'date':
          key = formatDateGroup(photo.capturedAt || photo.createdAt);
          break;
        case 'tag':
          key = photo.quickTag || 'Untagged';
          break;
        case 'defect':
          key = photo.defectId ? `Defect ${photo.defectId.slice(0, 8)}` : 'General';
          break;
        case 'element':
          key = photo.roofElementId ? `Element ${photo.roofElementId.slice(0, 8)}` : 'General';
          break;
        default:
          key = 'All';
      }

      const existing = groups.get(key) || [];
      groups.set(key, [...existing, photo]);
    });

    return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
  }, [sortedPhotos, groupBy]);

  return {
    photos: sortedPhotos,
    groupedPhotos,
    filters,
    setFilters,
    groupBy,
    setGroupBy,
    sortOrder,
    setSortOrder,
    totalCount: allPhotos.length,
    filteredCount: filteredPhotos.length,
  };
}

function formatDateGroup(isoString: string | null): string {
  if (!isoString) return 'Unknown Date';

  const date = new Date(isoString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}
```

### Example 3: Annotation Workflow with Evidence Integrity

```typescript
// Pattern for annotation save with full evidence chain
async function handleAnnotationSave(
  photoId: string,
  annotations: Annotation[],
  viewShotRef: ViewShot
) {
  // 1. Capture the annotated view (working copy + SVG overlay)
  const capturedUri = await viewShotRef.capture({
    format: 'jpg',
    quality: 0.9,
  });

  // 2. Save via annotation service (handles file copy + DB update)
  const result = await saveAnnotations(photoId, annotations, capturedUri);

  if (result.success) {
    // 3. Log to chain of custody (already done in annotation-service)
    // The original file in originals/ remains untouched
    // The annotated version is a new file in annotations/

    // 4. Optionally verify original integrity hasn't changed
    const photo = await getPhotoById(photoId);
    const verification = await verifyFileHash(
      getOriginalPath(photo.originalFilename),
      photo.originalHash
    );

    if (!verification.isValid) {
      console.error('CRITICAL: Original file integrity compromised!');
      // Alert user, log to audit trail
    }
  }

  return result;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| expo-image-picker resize | expo-image-manipulator | SDK 48 | Better API, background processing |
| Manual gesture handling | react-native-gesture-handler v2 | 2023 | Reanimated integration, smoother |
| FlatList only | FlatList + SectionList | N/A | SectionList for grouped data |
| PNG thumbnails | JPEG thumbnails 70% quality | Best practice | Smaller files, faster load |

**Deprecated/outdated:**
- `react-native-photo-view`: Archived, use `@likashefqet/react-native-image-zoom`
- `expo-image` for manipulation: Use `expo-image-manipulator` (separate package)
- Custom hash implementations: Use `expo-crypto` digestStringAsync

## Open Questions

1. **Offline annotation sync strategy**
   - What we know: Annotations saved locally, synced via sync queue
   - What's unclear: How server handles annotation file upload (multipart? separate endpoint?)
   - Recommendation: Follow existing photo upload pattern with presigned URLs

2. **Maximum photo count per report**
   - What we know: FlatList handles 100-200 items well
   - What's unclear: Performance with 500+ photos per report
   - Recommendation: Monitor performance, implement pagination if needed

3. **Annotation format for web platform**
   - What we know: Annotations stored as JSON (Annotation[] type)
   - What's unclear: Whether web platform renders same SVG or uses rasterized version
   - Recommendation: Sync both JSON and rendered image, web can choose

## Sources

### Primary (HIGH confidence)
- Existing codebase: `photo-service.ts`, `annotation-service.ts`, `PhotoAnnotator.tsx`
- [Expo ImageManipulator Docs](https://docs.expo.dev/versions/latest/sdk/imagemanipulator/)
- [React Native FlatList Optimization](https://reactnative.dev/docs/optimizing-flatlist-configuration)

### Secondary (MEDIUM confidence)
- [react-native-view-shot GitHub](https://github.com/gre/react-native-view-shot)
- [@likashefqet/react-native-image-zoom](https://github.com/likashefqet/react-native-image-zoom)
- [React Native SectionList Guide](https://codercrafter.in/blogs/react-native/sectionlist-react-native-complete-guide-with-real-examples)

### Tertiary (LOW confidence)
- General web search results for patterns and best practices

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Based on existing codebase analysis and official Expo docs
- Architecture: HIGH - Extends existing proven patterns in codebase
- Pitfalls: MEDIUM - Based on React Native community experience and existing code patterns
- Evidence integrity: HIGH - Existing implementation is court-ready, patterns documented in code

**Research date:** 2026-02-07
**Valid until:** 2026-03-09 (30 days - stable technology stack)

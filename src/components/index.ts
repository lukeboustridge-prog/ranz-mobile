/**
 * Component Exports
 * Central export file for all reusable components
 */

// Badges
export { SeverityBadge } from "./badges/SeverityBadge";
export { ClassificationBadge } from "./badges/ClassificationBadge";
export { ConditionBadge } from "./badges/ConditionBadge";
export { StatusBadge } from "./badges/StatusBadge";
export { RoleBadge } from "./badges/RoleBadge";

// Form Components
export { ChipSelector } from "./ChipSelector";
export type { ChipOption } from "./ChipSelector";
export { FormSection } from "./FormSection";
export { PhotoGrid } from "./PhotoGrid";

// Photo Gallery
export { PhotoGalleryScreen } from "./PhotoGalleryScreen";
export type { PhotoGalleryScreenProps } from "./PhotoGalleryScreen";
export { PhotoGalleryHeader } from "./PhotoGalleryHeader";
export type { PhotoGalleryHeaderProps } from "./PhotoGalleryHeader";
export { PhotoGalleryFilters } from "./PhotoGalleryFilters";
export type { PhotoGalleryFiltersProps } from "./PhotoGalleryFilters";

// Camera
export { CameraCapture } from "./CameraCapture";
export type { RoofElementOption } from "./CameraCapture";

// Permissions
export { PermissionGate } from "./PermissionGate";

// Voice Notes
export { VoiceNoteRecorder } from "./VoiceNoteRecorder";

// Photo Annotation
export { PhotoAnnotator } from "./PhotoAnnotator";
export type { Annotation, AnnotationTool, Point } from "./PhotoAnnotator";
export { PhotoAnnotationScreen } from "./PhotoAnnotationScreen";
export { PhotoAnnotationFlow } from "./PhotoAnnotationFlow";

// Photo Viewer
export { PhotoFullScreenViewer } from "./PhotoFullScreenViewer";

// Video Capture
export { VideoCapture } from "./VideoCapture";

// Barcode Scanner
export { BarcodeScanner } from "./BarcodeScanner";
export type { ScannedBarcode, BarcodeType } from "./BarcodeScanner";

// Measurement Tool
export { MeasurementTool } from "./MeasurementTool";
export type {
  MeasurementType,
  Measurement,
  LineMeasurement,
  RectMeasurement,
  PolygonMeasurement,
  Calibration,
  Point as MeasurementPoint,
} from "./MeasurementTool";

// Review Components
export { ReviewActionDialog } from "./ReviewActionDialog";
export type { ReviewActionType } from "./ReviewActionDialog";
export { ReviewCommentsPanel } from "./ReviewCommentsPanel";

// Validation Components
export { PreSubmitChecklist } from "./PreSubmitChecklist";

// Error Handling
export { ErrorBoundary, ScreenErrorBoundary } from "./ErrorBoundary";

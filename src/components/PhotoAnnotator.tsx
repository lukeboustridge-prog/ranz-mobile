/**
 * PhotoAnnotator Component
 * Full-screen photo annotation tool with drawing capabilities
 */

import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  Dimensions,
  Alert,
  PanResponder,
  GestureResponderEvent,
} from "react-native";
import Svg, { Path, Circle, Rect, Line, G, Defs, Marker } from "react-native-svg";
import ViewShot from "react-native-view-shot";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ============================================
// TYPES
// ============================================

export type AnnotationTool = "pen" | "arrow" | "circle" | "rectangle" | "text";

export interface Point {
  x: number;
  y: number;
}

export interface Annotation {
  id: string;
  tool: AnnotationTool;
  color: string;
  strokeWidth: number;
  points?: Point[];
  startPoint?: Point;
  endPoint?: Point;
  text?: string;
}

interface PhotoAnnotatorProps {
  imageUri: string;
  onSave: (annotatedUri: string, annotations: Annotation[]) => void;
  onCancel: () => void;
  initialAnnotations?: Annotation[];
}

// ============================================
// CONSTANTS
// ============================================

const COLORS = [
  "#ef4444", // Red
  "#f59e0b", // Orange
  "#22c55e", // Green
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ffffff", // White
  "#000000", // Black
];

const STROKE_WIDTHS = [2, 4, 6, 8];

const TOOLS: { tool: AnnotationTool; icon: string; label: string }[] = [
  { tool: "pen", icon: "✏️", label: "Pen" },
  { tool: "arrow", icon: "➡️", label: "Arrow" },
  { tool: "circle", icon: "⭕", label: "Circle" },
  { tool: "rectangle", icon: "⬜", label: "Rectangle" },
];

// ============================================
// COMPONENT
// ============================================

export function PhotoAnnotator({
  imageUri,
  onSave,
  onCancel,
  initialAnnotations = [],
}: PhotoAnnotatorProps) {
  const viewShotRef = useRef<ViewShot>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const [currentAnnotation, setCurrentAnnotation] = useState<Annotation | null>(null);
  const [undoStack, setUndoStack] = useState<Annotation[][]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[][]>([]);

  const [selectedTool, setSelectedTool] = useState<AnnotationTool>("pen");
  const [selectedColor, setSelectedColor] = useState("#ef4444");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showStrokePicker, setShowStrokePicker] = useState(false);

  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0, x: 0, y: 0 });

  // Use refs for values needed in pan responder to avoid stale closures
  const toolRef = useRef(selectedTool);
  const colorRef = useRef(selectedColor);
  const strokeRef = useRef(strokeWidth);
  const annotationsRef = useRef(annotations);

  // Keep refs in sync with state
  React.useEffect(() => { toolRef.current = selectedTool; }, [selectedTool]);
  React.useEffect(() => { colorRef.current = selectedColor; }, [selectedColor]);
  React.useEffect(() => { strokeRef.current = strokeWidth; }, [strokeWidth]);
  React.useEffect(() => { annotationsRef.current = annotations; }, [annotations]);

  const generateId = () => `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Calculate touch position relative to image
  const getTouchPosition = useCallback(
    (event: GestureResponderEvent): Point => {
      const { locationX, locationY } = event.nativeEvent;
      return { x: locationX, y: locationY };
    },
    []
  );

  // Pan responder for drawing
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        const point = getTouchPosition(event);
        const tool = toolRef.current;
        const color = colorRef.current;
        const sw = strokeRef.current;

        const newAnnotation: Annotation = {
          id: generateId(),
          tool,
          color,
          strokeWidth: sw,
          points: tool === "pen" ? [point] : undefined,
          startPoint: tool !== "pen" ? point : undefined,
          endPoint: tool !== "pen" ? point : undefined,
        };

        setCurrentAnnotation(newAnnotation);
      },
      onPanResponderMove: (event) => {
        const point = getTouchPosition(event);
        const tool = toolRef.current;

        setCurrentAnnotation((prev) => {
          if (!prev) return prev;

          if (tool === "pen") {
            if (!prev.points) return prev;
            return {
              ...prev,
              points: [...prev.points, point],
            };
          } else {
            return {
              ...prev,
              endPoint: point,
            };
          }
        });
      },
      onPanResponderRelease: () => {
        setCurrentAnnotation((current) => {
          if (current) {
            // Save to undo stack and add annotation
            setUndoStack((prev) => [...prev, annotationsRef.current]);
            setRedoStack([]);
            setAnnotations((prev) => [...prev, current]);
          }
          return null;
        });
      },
    })
  ).current;

  
  const handleUndo = () => {
    if (undoStack.length === 0) return;

    const previousState = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, annotations]);
    setAnnotations(previousState);
    setUndoStack((prev) => prev.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;

    const nextState = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, annotations]);
    setAnnotations(nextState);
    setRedoStack((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    Alert.alert("Clear All", "Remove all annotations?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          setUndoStack((prev) => [...prev, annotations]);
          setRedoStack([]);
          setAnnotations([]);
        },
      },
    ]);
  };

  const handleSave = async () => {
    try {
      if (viewShotRef.current) {
        const uri = await viewShotRef.current.capture?.();
        if (uri) {
          onSave(uri, annotations);
        }
      }
    } catch (error) {
      console.error("Failed to save annotated image:", error);
      Alert.alert("Error", "Failed to save annotated image");
    }
  };

  // Render a single annotation
  const renderAnnotation = (annotation: Annotation, isPreview = false) => {
    const { id, tool, color, strokeWidth: sw, points, startPoint, endPoint } = annotation;
    const key = isPreview ? `preview-${id}` : id;

    switch (tool) {
      case "pen":
        if (!points || points.length < 2) return null;
        const pathData = points
          .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
          .join(" ");
        return (
          <Path
            key={key}
            d={pathData}
            stroke={color}
            strokeWidth={sw}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case "arrow":
        if (!startPoint || !endPoint) return null;
        const angle = Math.atan2(
          endPoint.y - startPoint.y,
          endPoint.x - startPoint.x
        );
        const arrowLength = 15;
        const arrowAngle = Math.PI / 6;

        const arrowPoint1 = {
          x: endPoint.x - arrowLength * Math.cos(angle - arrowAngle),
          y: endPoint.y - arrowLength * Math.sin(angle - arrowAngle),
        };
        const arrowPoint2 = {
          x: endPoint.x - arrowLength * Math.cos(angle + arrowAngle),
          y: endPoint.y - arrowLength * Math.sin(angle + arrowAngle),
        };

        return (
          <G key={key}>
            <Line
              x1={startPoint.x}
              y1={startPoint.y}
              x2={endPoint.x}
              y2={endPoint.y}
              stroke={color}
              strokeWidth={sw}
              strokeLinecap="round"
            />
            <Line
              x1={endPoint.x}
              y1={endPoint.y}
              x2={arrowPoint1.x}
              y2={arrowPoint1.y}
              stroke={color}
              strokeWidth={sw}
              strokeLinecap="round"
            />
            <Line
              x1={endPoint.x}
              y1={endPoint.y}
              x2={arrowPoint2.x}
              y2={arrowPoint2.y}
              stroke={color}
              strokeWidth={sw}
              strokeLinecap="round"
            />
          </G>
        );

      case "circle":
        if (!startPoint || !endPoint) return null;
        const cx = (startPoint.x + endPoint.x) / 2;
        const cy = (startPoint.y + endPoint.y) / 2;
        const rx = Math.abs(endPoint.x - startPoint.x) / 2;
        const ry = Math.abs(endPoint.y - startPoint.y) / 2;
        return (
          <Circle
            key={key}
            cx={cx}
            cy={cy}
            r={Math.max(rx, ry)}
            stroke={color}
            strokeWidth={sw}
            fill="none"
          />
        );

      case "rectangle":
        if (!startPoint || !endPoint) return null;
        const x = Math.min(startPoint.x, endPoint.x);
        const y = Math.min(startPoint.y, endPoint.y);
        const width = Math.abs(endPoint.x - startPoint.x);
        const height = Math.abs(endPoint.y - startPoint.y);
        return (
          <Rect
            key={key}
            x={x}
            y={y}
            width={width}
            height={height}
            stroke={color}
            strokeWidth={sw}
            fill="none"
          />
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={onCancel}>
          <Text style={styles.headerButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Annotate Photo</Text>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* Canvas Area */}
      <View style={styles.canvasContainer}>
        <ViewShot
          ref={viewShotRef}
          options={{ format: "jpg", quality: 0.9 }}
          style={styles.viewShot}
        >
          <View
            style={styles.imageContainer}
            onLayout={(e) => {
              const { width, height, x, y } = e.nativeEvent.layout;
              setImageLayout({ width, height, x, y });
            }}
            {...panResponder.panHandlers}
          >
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="contain"
            />
            <Svg style={StyleSheet.absoluteFill}>
              {annotations.map((ann) => renderAnnotation(ann))}
              {currentAnnotation && renderAnnotation(currentAnnotation, true)}
            </Svg>
          </View>
        </ViewShot>
      </View>

      {/* Tool Options */}
      {showColorPicker && (
        <View style={styles.pickerContainer}>
          <Text style={styles.pickerTitle}>Color</Text>
          <View style={styles.colorOptions}>
            {COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorOption,
                  { backgroundColor: color },
                  selectedColor === color && styles.colorOptionSelected,
                ]}
                onPress={() => {
                  setSelectedColor(color);
                  setShowColorPicker(false);
                }}
              />
            ))}
          </View>
        </View>
      )}

      {showStrokePicker && (
        <View style={styles.pickerContainer}>
          <Text style={styles.pickerTitle}>Stroke Width</Text>
          <View style={styles.strokeOptions}>
            {STROKE_WIDTHS.map((sw) => (
              <TouchableOpacity
                key={sw}
                style={[
                  styles.strokeOption,
                  strokeWidth === sw && styles.strokeOptionSelected,
                ]}
                onPress={() => {
                  setStrokeWidth(sw);
                  setShowStrokePicker(false);
                }}
              >
                <View
                  style={[
                    styles.strokePreview,
                    { height: sw, backgroundColor: selectedColor },
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Toolbar */}
      <View style={styles.toolbar}>
        {/* Tools */}
        <View style={styles.toolSection}>
          {TOOLS.map((t) => (
            <TouchableOpacity
              key={t.tool}
              style={[
                styles.toolButton,
                selectedTool === t.tool && styles.toolButtonActive,
              ]}
              onPress={() => setSelectedTool(t.tool)}
            >
              <Text style={styles.toolIcon}>{t.icon}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Divider */}
        <View style={styles.toolDivider} />

        {/* Color & Stroke */}
        <View style={styles.toolSection}>
          <TouchableOpacity
            style={[styles.colorButton, { backgroundColor: selectedColor }]}
            onPress={() => {
              setShowColorPicker(!showColorPicker);
              setShowStrokePicker(false);
            }}
          />
          <TouchableOpacity
            style={styles.strokeButton}
            onPress={() => {
              setShowStrokePicker(!showStrokePicker);
              setShowColorPicker(false);
            }}
          >
            <View
              style={[
                styles.strokeButtonPreview,
                { height: strokeWidth, backgroundColor: selectedColor },
              ]}
            />
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.toolDivider} />

        {/* Actions */}
        <View style={styles.toolSection}>
          <TouchableOpacity
            style={[styles.actionButton, undoStack.length === 0 && styles.actionButtonDisabled]}
            onPress={handleUndo}
            disabled={undoStack.length === 0}
          >
            <Text style={styles.actionIcon}>↩️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, redoStack.length === 0 && styles.actionButtonDisabled]}
            onPress={handleRedo}
            disabled={redoStack.length === 0}
          >
            <Text style={styles.actionIcon}>↪️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, annotations.length === 0 && styles.actionButtonDisabled]}
            onPress={handleClear}
            disabled={annotations.length === 0}
          >
            <Text style={styles.actionIcon}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#111",
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  headerButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#2d5c8f",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  canvasContainer: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  viewShot: {
    flex: 1,
  },
  imageContainer: {
    flex: 1,
    position: "relative",
  },
  image: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  pickerContainer: {
    backgroundColor: "#222",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  pickerTitle: {
    color: "#888",
    fontSize: 12,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  colorOptions: {
    flexDirection: "row",
    gap: 12,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorOptionSelected: {
    borderColor: "#fff",
  },
  strokeOptions: {
    flexDirection: "row",
    gap: 12,
  },
  strokeOption: {
    width: 60,
    height: 36,
    backgroundColor: "#333",
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  strokeOptionSelected: {
    borderColor: "#2d5c8f",
  },
  strokePreview: {
    width: 40,
    borderRadius: 2,
  },
  toolbar: {
    flexDirection: "row",
    backgroundColor: "#111",
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  toolSection: {
    flexDirection: "row",
    gap: 8,
  },
  toolDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#333",
    marginHorizontal: 12,
  },
  toolButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
  },
  toolButtonActive: {
    backgroundColor: "#2d5c8f",
  },
  toolIcon: {
    fontSize: 20,
  },
  colorButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: "#444",
  },
  strokeButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
  },
  strokeButtonPreview: {
    width: 28,
    borderRadius: 2,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  actionIcon: {
    fontSize: 18,
  },
});

export default PhotoAnnotator;

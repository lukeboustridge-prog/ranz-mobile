/**
 * PhotoAnnotator Component
 * Full-screen photo annotation tool with comprehensive drawing capabilities
 *
 * Tools:
 * - Pen: Freehand drawing
 * - Arrow: Directional arrows
 * - Circle: Ellipse shapes
 * - Rectangle: Box shapes
 * - Text: Text labels
 * - Highlighter: Semi-transparent marking
 * - Marker: Numbered crosshairs for defect pointing
 * - Measure: Dimension lines with labels
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
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import Svg, { Path, Circle, Rect, Line, G, Text as SvgText, Polygon } from "react-native-svg";
import ViewShot from "react-native-view-shot";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ============================================
// TYPES
// ============================================

export type AnnotationTool =
  | "pen"
  | "arrow"
  | "circle"
  | "rectangle"
  | "text"
  | "highlighter"
  | "marker"
  | "measure";

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
  fontSize?: number;
  markerNumber?: number;
  measurementValue?: string;
  opacity?: number;
}

interface PhotoAnnotatorProps {
  imageUri: string;
  onSave: (annotatedUri: string, annotations: Annotation[]) => void;
  onCancel: () => void;
  initialAnnotations?: Annotation[];
  scaleReference?: string; // e.g., "100mm" for calibration
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
  "#ec4899", // Pink
  "#ffffff", // White
  "#000000", // Black
];

const HIGHLIGHTER_COLORS = [
  "#fef08a", // Yellow
  "#bbf7d0", // Green
  "#bfdbfe", // Blue
  "#fbcfe8", // Pink
];

const STROKE_WIDTHS = [2, 4, 6, 8];
const FONT_SIZES = [14, 18, 24, 32];

interface ToolConfig {
  tool: AnnotationTool;
  icon: string;
  label: string;
}

const TOOLS: ToolConfig[] = [
  { tool: "pen", icon: "✏️", label: "Pen" },
  { tool: "arrow", icon: "➡️", label: "Arrow" },
  { tool: "circle", icon: "⭕", label: "Circle" },
  { tool: "rectangle", icon: "⬜", label: "Rectangle" },
  { tool: "text", icon: "T", label: "Text" },
  { tool: "highlighter", icon: "🖍️", label: "Highlight" },
  { tool: "marker", icon: "📍", label: "Marker" },
  { tool: "measure", icon: "📏", label: "Measure" },
];

// ============================================
// COMPONENT
// ============================================

export function PhotoAnnotator({
  imageUri,
  onSave,
  onCancel,
  initialAnnotations = [],
  scaleReference,
}: PhotoAnnotatorProps) {
  const viewShotRef = useRef<ViewShot>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const [currentAnnotation, setCurrentAnnotation] = useState<Annotation | null>(null);
  const [undoStack, setUndoStack] = useState<Annotation[][]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[][]>([]);

  const [selectedTool, setSelectedTool] = useState<AnnotationTool>("pen");
  const [selectedColor, setSelectedColor] = useState("#ef4444");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [fontSize, setFontSize] = useState(18);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showStrokePicker, setShowStrokePicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);

  // Text input modal
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInputValue, setTextInputValue] = useState("");
  const [pendingTextPosition, setPendingTextPosition] = useState<Point | null>(null);

  // Measurement input modal
  const [showMeasureInput, setShowMeasureInput] = useState(false);
  const [measureInputValue, setMeasureInputValue] = useState("");
  const [pendingMeasureAnnotation, setPendingMeasureAnnotation] = useState<Annotation | null>(null);

  // Marker counter
  const [markerCount, setMarkerCount] = useState(1);

  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0, x: 0, y: 0 });

  // Use refs for values needed in pan responder
  const toolRef = useRef(selectedTool);
  const colorRef = useRef(selectedColor);
  const strokeRef = useRef(strokeWidth);
  const fontSizeRef = useRef(fontSize);
  const annotationsRef = useRef(annotations);
  const markerCountRef = useRef(markerCount);

  // Keep refs in sync with state
  React.useEffect(() => { toolRef.current = selectedTool; }, [selectedTool]);
  React.useEffect(() => { colorRef.current = selectedColor; }, [selectedColor]);
  React.useEffect(() => { strokeRef.current = strokeWidth; }, [strokeWidth]);
  React.useEffect(() => { fontSizeRef.current = fontSize; }, [fontSize]);
  React.useEffect(() => { annotationsRef.current = annotations; }, [annotations]);
  React.useEffect(() => { markerCountRef.current = markerCount; }, [markerCount]);

  const generateId = () => `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Calculate touch position relative to image
  const getTouchPosition = useCallback(
    (event: GestureResponderEvent): Point => {
      const { locationX, locationY } = event.nativeEvent;
      return { x: locationX, y: locationY };
    },
    []
  );

  // Handle tool-specific tap actions
  const handleTap = (point: Point) => {
    const tool = toolRef.current;

    if (tool === "text") {
      setPendingTextPosition(point);
      setTextInputValue("");
      setShowTextInput(true);
    } else if (tool === "marker") {
      const newAnnotation: Annotation = {
        id: generateId(),
        tool: "marker",
        color: colorRef.current,
        strokeWidth: strokeRef.current,
        startPoint: point,
        markerNumber: markerCountRef.current,
      };

      setUndoStack((prev) => [...prev, annotationsRef.current]);
      setRedoStack([]);
      setAnnotations((prev) => [...prev, newAnnotation]);
      setMarkerCount((prev) => prev + 1);
    }
  };

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

        // Text and marker tools use tap, not drag
        if (tool === "text" || tool === "marker") {
          return;
        }

        const newAnnotation: Annotation = {
          id: generateId(),
          tool,
          color: tool === "highlighter" ? "#fef08a" : color,
          strokeWidth: tool === "highlighter" ? 20 : sw,
          opacity: tool === "highlighter" ? 0.4 : 1,
          points: (tool === "pen" || tool === "highlighter") ? [point] : undefined,
          startPoint: (tool !== "pen" && tool !== "highlighter") ? point : undefined,
          endPoint: (tool !== "pen" && tool !== "highlighter") ? point : undefined,
        };

        setCurrentAnnotation(newAnnotation);
      },
      onPanResponderMove: (event) => {
        const point = getTouchPosition(event);
        const tool = toolRef.current;

        if (tool === "text" || tool === "marker") {
          return;
        }

        setCurrentAnnotation((prev) => {
          if (!prev) return prev;

          if (tool === "pen" || tool === "highlighter") {
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
      onPanResponderRelease: (event) => {
        const tool = toolRef.current;
        const point = getTouchPosition(event);

        // Handle tap for text and marker
        if (tool === "text" || tool === "marker") {
          handleTap(point);
          return;
        }

        setCurrentAnnotation((current) => {
          if (current) {
            // For measure tool, prompt for value
            if (tool === "measure" && current.startPoint && current.endPoint) {
              setPendingMeasureAnnotation(current);
              setMeasureInputValue("");
              setShowMeasureInput(true);
              return null;
            }

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
          setMarkerCount(1);
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

  // Handle text input confirmation
  const handleTextConfirm = () => {
    if (pendingTextPosition && textInputValue.trim()) {
      const newAnnotation: Annotation = {
        id: generateId(),
        tool: "text",
        color: selectedColor,
        strokeWidth: 0,
        startPoint: pendingTextPosition,
        text: textInputValue.trim(),
        fontSize: fontSize,
      };

      setUndoStack((prev) => [...prev, annotations]);
      setRedoStack([]);
      setAnnotations((prev) => [...prev, newAnnotation]);
    }

    setShowTextInput(false);
    setPendingTextPosition(null);
    setTextInputValue("");
  };

  // Handle measurement input confirmation
  const handleMeasureConfirm = () => {
    if (pendingMeasureAnnotation && measureInputValue.trim()) {
      const annotationWithValue: Annotation = {
        ...pendingMeasureAnnotation,
        measurementValue: measureInputValue.trim(),
      };

      setUndoStack((prev) => [...prev, annotations]);
      setRedoStack([]);
      setAnnotations((prev) => [...prev, annotationWithValue]);
    }

    setShowMeasureInput(false);
    setPendingMeasureAnnotation(null);
    setMeasureInputValue("");
  };

  // Render a single annotation
  const renderAnnotation = (annotation: Annotation, isPreview = false) => {
    const { id, tool, color, strokeWidth: sw, points, startPoint, endPoint, text, fontSize: fs, markerNumber, measurementValue, opacity } = annotation;
    const key = isPreview ? `preview-${id}` : id;

    switch (tool) {
      case "pen":
      case "highlighter":
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
            opacity={opacity ?? 1}
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
            <Polygon
              points={`${endPoint.x},${endPoint.y} ${arrowPoint1.x},${arrowPoint1.y} ${arrowPoint2.x},${arrowPoint2.y}`}
              fill={color}
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

      case "text":
        if (!startPoint || !text) return null;
        return (
          <G key={key}>
            {/* Text background for readability */}
            <Rect
              x={startPoint.x - 4}
              y={startPoint.y - (fs ?? 18) - 2}
              width={text.length * (fs ?? 18) * 0.6 + 8}
              height={(fs ?? 18) + 8}
              fill="rgba(0,0,0,0.6)"
              rx={4}
            />
            <SvgText
              x={startPoint.x}
              y={startPoint.y}
              fill={color}
              fontSize={fs ?? 18}
              fontWeight="bold"
            >
              {text}
            </SvgText>
          </G>
        );

      case "marker":
        if (!startPoint) return null;
        const markerSize = 24;
        const num = markerNumber ?? 1;
        return (
          <G key={key}>
            {/* Crosshair */}
            <Line
              x1={startPoint.x - 12}
              y1={startPoint.y}
              x2={startPoint.x + 12}
              y2={startPoint.y}
              stroke={color}
              strokeWidth={2}
            />
            <Line
              x1={startPoint.x}
              y1={startPoint.y - 12}
              x2={startPoint.x}
              y2={startPoint.y + 12}
              stroke={color}
              strokeWidth={2}
            />
            {/* Number circle */}
            <Circle
              cx={startPoint.x + 16}
              cy={startPoint.y - 16}
              r={12}
              fill={color}
            />
            <SvgText
              x={startPoint.x + 16}
              y={startPoint.y - 12}
              fill="#fff"
              fontSize={12}
              fontWeight="bold"
              textAnchor="middle"
            >
              {num}
            </SvgText>
          </G>
        );

      case "measure":
        if (!startPoint || !endPoint) return null;
        const mAngle = Math.atan2(
          endPoint.y - startPoint.y,
          endPoint.x - startPoint.x
        );
        const perpAngle = mAngle + Math.PI / 2;
        const tickLength = 8;

        // Tick marks at ends
        const tick1Start = {
          x: startPoint.x + tickLength * Math.cos(perpAngle),
          y: startPoint.y + tickLength * Math.sin(perpAngle),
        };
        const tick1End = {
          x: startPoint.x - tickLength * Math.cos(perpAngle),
          y: startPoint.y - tickLength * Math.sin(perpAngle),
        };
        const tick2Start = {
          x: endPoint.x + tickLength * Math.cos(perpAngle),
          y: endPoint.y + tickLength * Math.sin(perpAngle),
        };
        const tick2End = {
          x: endPoint.x - tickLength * Math.cos(perpAngle),
          y: endPoint.y - tickLength * Math.sin(perpAngle),
        };

        // Text position (middle of line)
        const midX = (startPoint.x + endPoint.x) / 2;
        const midY = (startPoint.y + endPoint.y) / 2;

        return (
          <G key={key}>
            {/* Main line */}
            <Line
              x1={startPoint.x}
              y1={startPoint.y}
              x2={endPoint.x}
              y2={endPoint.y}
              stroke={color}
              strokeWidth={sw}
            />
            {/* End ticks */}
            <Line
              x1={tick1Start.x}
              y1={tick1Start.y}
              x2={tick1End.x}
              y2={tick1End.y}
              stroke={color}
              strokeWidth={sw}
            />
            <Line
              x1={tick2Start.x}
              y1={tick2Start.y}
              x2={tick2End.x}
              y2={tick2End.y}
              stroke={color}
              strokeWidth={sw}
            />
            {/* Measurement label */}
            {measurementValue && (
              <>
                <Rect
                  x={midX - measurementValue.length * 5 - 6}
                  y={midY - 20}
                  width={measurementValue.length * 10 + 12}
                  height={24}
                  fill="rgba(0,0,0,0.7)"
                  rx={4}
                />
                <SvgText
                  x={midX}
                  y={midY - 4}
                  fill="#fff"
                  fontSize={14}
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {measurementValue}
                </SvgText>
              </>
            )}
          </G>
        );

      default:
        return null;
    }
  };

  const isHighlighterSelected = selectedTool === "highlighter";

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

      {/* Tool Options - Color Picker */}
      {showColorPicker && (
        <View style={styles.pickerContainer}>
          <Text style={styles.pickerTitle}>
            {isHighlighterSelected ? "Highlighter Color" : "Color"}
          </Text>
          <View style={styles.colorOptions}>
            {(isHighlighterSelected ? HIGHLIGHTER_COLORS : COLORS).map((color) => (
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

      {/* Stroke Picker */}
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

      {/* Font Size Picker (for text tool) */}
      {showFontPicker && (
        <View style={styles.pickerContainer}>
          <Text style={styles.pickerTitle}>Font Size</Text>
          <View style={styles.strokeOptions}>
            {FONT_SIZES.map((fs) => (
              <TouchableOpacity
                key={fs}
                style={[
                  styles.strokeOption,
                  fontSize === fs && styles.strokeOptionSelected,
                ]}
                onPress={() => {
                  setFontSize(fs);
                  setShowFontPicker(false);
                }}
              >
                <Text style={[styles.fontSizePreview, { fontSize: Math.min(fs, 20) }]}>
                  {fs}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.toolbarInner}>
            {/* Tools */}
            <View style={styles.toolSection}>
              {TOOLS.map((t) => (
                <TouchableOpacity
                  key={t.tool}
                  style={[
                    styles.toolButton,
                    selectedTool === t.tool && styles.toolButtonActive,
                  ]}
                  onPress={() => {
                    setSelectedTool(t.tool);
                    setShowColorPicker(false);
                    setShowStrokePicker(false);
                    setShowFontPicker(false);
                  }}
                >
                  <Text style={[
                    styles.toolIcon,
                    t.tool === "text" && styles.textToolIcon,
                  ]}>
                    {t.icon}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Divider */}
            <View style={styles.toolDivider} />

            {/* Color & Options */}
            <View style={styles.toolSection}>
              <TouchableOpacity
                style={[styles.colorButton, { backgroundColor: selectedColor }]}
                onPress={() => {
                  setShowColorPicker(!showColorPicker);
                  setShowStrokePicker(false);
                  setShowFontPicker(false);
                }}
              />

              {selectedTool !== "text" && selectedTool !== "marker" && (
                <TouchableOpacity
                  style={styles.strokeButton}
                  onPress={() => {
                    setShowStrokePicker(!showStrokePicker);
                    setShowColorPicker(false);
                    setShowFontPicker(false);
                  }}
                >
                  <View
                    style={[
                      styles.strokeButtonPreview,
                      { height: strokeWidth, backgroundColor: selectedColor },
                    ]}
                  />
                </TouchableOpacity>
              )}

              {selectedTool === "text" && (
                <TouchableOpacity
                  style={styles.strokeButton}
                  onPress={() => {
                    setShowFontPicker(!showFontPicker);
                    setShowColorPicker(false);
                    setShowStrokePicker(false);
                  }}
                >
                  <Text style={styles.fontButtonText}>{fontSize}</Text>
                </TouchableOpacity>
              )}
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
        </ScrollView>
      </View>

      {/* Text Input Modal */}
      <Modal visible={showTextInput} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Text Label</Text>
            <TextInput
              style={styles.textInput}
              value={textInputValue}
              onChangeText={setTextInputValue}
              placeholder="Enter text..."
              placeholderTextColor="#999"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleTextConfirm}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowTextInput(false);
                  setPendingTextPosition(null);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleTextConfirm}
              >
                <Text style={styles.modalConfirmText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Measurement Input Modal */}
      <Modal visible={showMeasureInput} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Measurement</Text>
            <Text style={styles.modalSubtitle}>
              Add a dimension label (e.g., "300mm", "1.2m")
            </Text>
            <TextInput
              style={styles.textInput}
              value={measureInputValue}
              onChangeText={setMeasureInputValue}
              placeholder="e.g., 300mm"
              placeholderTextColor="#999"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleMeasureConfirm}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowMeasureInput(false);
                  setPendingMeasureAnnotation(null);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleMeasureConfirm}
              >
                <Text style={styles.modalConfirmText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    flexWrap: "wrap",
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
  fontSizePreview: {
    color: "#fff",
    fontWeight: "600",
  },
  toolbar: {
    backgroundColor: "#111",
    paddingVertical: 12,
  },
  toolbarInner: {
    flexDirection: "row",
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
  textToolIcon: {
    fontWeight: "bold",
    color: "#fff",
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
  fontButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#666",
    marginBottom: 16,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111",
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#2d5c8f",
    alignItems: "center",
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
});

export default PhotoAnnotator;

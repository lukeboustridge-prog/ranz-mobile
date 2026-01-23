/**
 * MeasurementTool Component
 * Measure distances and areas on photos with calibration support
 */

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  Dimensions,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import Svg, { Line, Circle, Rect, Polygon, G, Text as SvgText } from "react-native-svg";
import { captureRef } from "react-native-view-shot";

// ============================================
// TYPES
// ============================================

export type MeasurementType = "line" | "rectangle" | "polygon";

export interface Point {
  x: number;
  y: number;
}

export interface LineMeasurement {
  id: string;
  type: "line";
  start: Point;
  end: Point;
  pixelLength: number;
  realLength: number | null; // in mm
}

export interface RectMeasurement {
  id: string;
  type: "rectangle";
  start: Point;
  end: Point;
  pixelWidth: number;
  pixelHeight: number;
  realWidth: number | null; // in mm
  realHeight: number | null; // in mm
  realArea: number | null; // in mm²
}

export interface PolygonMeasurement {
  id: string;
  type: "polygon";
  points: Point[];
  pixelPerimeter: number;
  pixelArea: number;
  realPerimeter: number | null; // in mm
  realArea: number | null; // in mm²
}

export type Measurement = LineMeasurement | RectMeasurement | PolygonMeasurement;

export interface Calibration {
  pixelsPerMm: number;
  referenceDescription: string;
}

interface MeasurementToolProps {
  imageUri: string;
  existingMeasurements?: Measurement[];
  existingCalibration?: Calibration | null;
  onSave: (
    measurements: Measurement[],
    calibration: Calibration | null,
    annotatedUri: string
  ) => void;
  onCancel: () => void;
}

// ============================================
// HELPERS
// ============================================

function generateId(): string {
  return `m_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

function calculateDistance(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

function calculatePolygonArea(points: Point[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area / 2);
}

function calculatePolygonPerimeter(points: Point[]): number {
  if (points.length < 2) return 0;
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    perimeter += calculateDistance(points[i], points[j]);
  }
  return perimeter;
}

function formatMeasurement(value: number | null, unit: string): string {
  if (value === null) return "---";
  if (value >= 1000 && unit === "mm") {
    return `${(value / 1000).toFixed(2)} m`;
  }
  if (value >= 1000000 && unit === "mm²") {
    return `${(value / 1000000).toFixed(2)} m²`;
  }
  return `${value.toFixed(1)} ${unit}`;
}

// ============================================
// COMPONENT
// ============================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export function MeasurementTool({
  imageUri,
  existingMeasurements = [],
  existingCalibration = null,
  onSave,
  onCancel,
}: MeasurementToolProps) {
  const viewShotRef = useRef<View>(null);

  const [measurements, setMeasurements] = useState<Measurement[]>(existingMeasurements);
  const [calibration, setCalibration] = useState<Calibration | null>(existingCalibration);
  const [selectedTool, setSelectedTool] = useState<MeasurementType>("line");
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [calibrationLine, setCalibrationLine] = useState<{ start: Point; end: Point } | null>(null);
  const [calibrationValue, setCalibrationValue] = useState("");
  const [calibrationDescription, setCalibrationDescription] = useState("");

  // Drawing state
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // Image dimensions
  const [imageSize, setImageSize] = useState({ width: SCREEN_WIDTH, height: SCREEN_WIDTH });
  const [imageLayout, setImageLayout] = useState({ x: 0, y: 0, width: SCREEN_WIDTH, height: SCREEN_WIDTH });

  // Refs for touch handling
  const toolRef = useRef(selectedTool);
  const isDrawingRef = useRef(isDrawing);
  const currentPointsRef = useRef(currentPoints);
  const isCalibratingRef = useRef(isCalibrating);

  useEffect(() => { toolRef.current = selectedTool; }, [selectedTool]);
  useEffect(() => { isDrawingRef.current = isDrawing; }, [isDrawing]);
  useEffect(() => { currentPointsRef.current = currentPoints; }, [currentPoints]);
  useEffect(() => { isCalibratingRef.current = isCalibrating; }, [isCalibrating]);

  // Load image dimensions
  useEffect(() => {
    Image.getSize(imageUri, (width, height) => {
      const aspectRatio = width / height;
      const displayWidth = SCREEN_WIDTH;
      const displayHeight = displayWidth / aspectRatio;
      setImageSize({ width: displayWidth, height: displayHeight });
    });
  }, [imageUri]);

  const handleImageLayout = (event: any) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setImageLayout({ x, y, width, height });
  };

  const getRelativePoint = (pageX: number, pageY: number): Point => {
    return {
      x: pageX - imageLayout.x,
      y: pageY - imageLayout.y,
    };
  };

  const handleTouchStart = (event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    const point = getRelativePoint(pageX, pageY);

    if (isCalibratingRef.current) {
      setCalibrationLine({ start: point, end: point });
      return;
    }

    setIsDrawing(true);
    setCurrentPoints([point]);
  };

  const handleTouchMove = (event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    const point = getRelativePoint(pageX, pageY);

    if (isCalibratingRef.current && calibrationLine) {
      setCalibrationLine({ ...calibrationLine, end: point });
      return;
    }

    if (!isDrawingRef.current) return;

    const tool = toolRef.current;
    const points = currentPointsRef.current;

    if (tool === "line" || tool === "rectangle") {
      // Update end point
      if (points.length > 0) {
        setCurrentPoints([points[0], point]);
      }
    } else if (tool === "polygon") {
      // For polygon, we'll add points on touch end
      if (points.length > 0) {
        setCurrentPoints([...points.slice(0, -1), point]);
      }
    }
  };

  const handleTouchEnd = () => {
    if (isCalibratingRef.current && calibrationLine) {
      const distance = calculateDistance(calibrationLine.start, calibrationLine.end);
      if (distance > 20) {
        setShowCalibrationModal(true);
      } else {
        setCalibrationLine(null);
      }
      return;
    }

    if (!isDrawingRef.current) return;

    const tool = toolRef.current;
    const points = currentPointsRef.current;

    if (tool === "line" && points.length === 2) {
      const pixelLength = calculateDistance(points[0], points[1]);
      if (pixelLength > 10) {
        const newMeasurement: LineMeasurement = {
          id: generateId(),
          type: "line",
          start: points[0],
          end: points[1],
          pixelLength,
          realLength: calibration ? pixelLength / calibration.pixelsPerMm : null,
        };
        setMeasurements([...measurements, newMeasurement]);
      }
      setCurrentPoints([]);
      setIsDrawing(false);
    } else if (tool === "rectangle" && points.length === 2) {
      const pixelWidth = Math.abs(points[1].x - points[0].x);
      const pixelHeight = Math.abs(points[1].y - points[0].y);
      if (pixelWidth > 10 && pixelHeight > 10) {
        const newMeasurement: RectMeasurement = {
          id: generateId(),
          type: "rectangle",
          start: points[0],
          end: points[1],
          pixelWidth,
          pixelHeight,
          realWidth: calibration ? pixelWidth / calibration.pixelsPerMm : null,
          realHeight: calibration ? pixelHeight / calibration.pixelsPerMm : null,
          realArea: calibration
            ? (pixelWidth / calibration.pixelsPerMm) * (pixelHeight / calibration.pixelsPerMm)
            : null,
        };
        setMeasurements([...measurements, newMeasurement]);
      }
      setCurrentPoints([]);
      setIsDrawing(false);
    } else if (tool === "polygon") {
      // Polygon stays in drawing mode until closed
    }
  };

  const handlePolygonTap = (event: any) => {
    if (selectedTool !== "polygon") return;

    const { pageX, pageY } = event.nativeEvent;
    const point = getRelativePoint(pageX, pageY);

    if (currentPoints.length === 0) {
      setCurrentPoints([point]);
      setIsDrawing(true);
    } else {
      // Check if tapping near first point to close polygon
      const firstPoint = currentPoints[0];
      const distance = calculateDistance(point, firstPoint);

      if (currentPoints.length >= 3 && distance < 30) {
        // Close polygon
        const pixelPerimeter = calculatePolygonPerimeter(currentPoints);
        const pixelArea = calculatePolygonArea(currentPoints);

        const newMeasurement: PolygonMeasurement = {
          id: generateId(),
          type: "polygon",
          points: [...currentPoints],
          pixelPerimeter,
          pixelArea,
          realPerimeter: calibration ? pixelPerimeter / calibration.pixelsPerMm : null,
          realArea: calibration
            ? pixelArea / (calibration.pixelsPerMm * calibration.pixelsPerMm)
            : null,
        };
        setMeasurements([...measurements, newMeasurement]);
        setCurrentPoints([]);
        setIsDrawing(false);
      } else {
        // Add point
        setCurrentPoints([...currentPoints, point]);
      }
    }
  };

  const handleCalibrationSave = () => {
    const value = parseFloat(calibrationValue);
    if (isNaN(value) || value <= 0) {
      Alert.alert("Invalid Value", "Please enter a valid measurement in millimeters.");
      return;
    }

    if (!calibrationLine) return;

    const pixelLength = calculateDistance(calibrationLine.start, calibrationLine.end);
    const pixelsPerMm = pixelLength / value;

    const newCalibration: Calibration = {
      pixelsPerMm,
      referenceDescription: calibrationDescription || "Reference line",
    };

    setCalibration(newCalibration);

    // Update all existing measurements with new calibration
    setMeasurements(measurements.map(m => {
      if (m.type === "line") {
        return { ...m, realLength: m.pixelLength / pixelsPerMm };
      } else if (m.type === "rectangle") {
        const realWidth = m.pixelWidth / pixelsPerMm;
        const realHeight = m.pixelHeight / pixelsPerMm;
        return {
          ...m,
          realWidth,
          realHeight,
          realArea: realWidth * realHeight
        };
      } else if (m.type === "polygon") {
        return {
          ...m,
          realPerimeter: m.pixelPerimeter / pixelsPerMm,
          realArea: m.pixelArea / (pixelsPerMm * pixelsPerMm),
        };
      }
      return m;
    }));

    setShowCalibrationModal(false);
    setCalibrationLine(null);
    setCalibrationValue("");
    setCalibrationDescription("");
    setIsCalibrating(false);
  };

  const handleUndo = () => {
    if (measurements.length > 0) {
      setMeasurements(measurements.slice(0, -1));
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      "Clear All",
      "Remove all measurements?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            setMeasurements([]);
            setCurrentPoints([]);
            setIsDrawing(false);
          }
        },
      ]
    );
  };

  const handleSave = async () => {
    try {
      // Capture the view with measurements
      if (viewShotRef.current) {
        const uri = await captureRef(viewShotRef, {
          format: "png",
          quality: 1,
        });
        onSave(measurements, calibration, uri);
      } else {
        onSave(measurements, calibration, imageUri);
      }
    } catch (error) {
      console.error("[MeasurementTool] Failed to capture:", error);
      onSave(measurements, calibration, imageUri);
    }
  };

  const renderMeasurement = (m: Measurement) => {
    const color = "#00ff00";
    const strokeWidth = 2;

    if (m.type === "line") {
      const midX = (m.start.x + m.end.x) / 2;
      const midY = (m.start.y + m.end.y) / 2;
      const label = formatMeasurement(m.realLength, "mm");

      return (
        <G key={m.id}>
          <Line
            x1={m.start.x}
            y1={m.start.y}
            x2={m.end.x}
            y2={m.end.y}
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Circle cx={m.start.x} cy={m.start.y} r={6} fill={color} />
          <Circle cx={m.end.x} cy={m.end.y} r={6} fill={color} />
          <Rect
            x={midX - 35}
            y={midY - 12}
            width={70}
            height={24}
            fill="rgba(0,0,0,0.7)"
            rx={4}
          />
          <SvgText
            x={midX}
            y={midY + 5}
            fill="#fff"
            fontSize={12}
            fontWeight="bold"
            textAnchor="middle"
          >
            {label}
          </SvgText>
        </G>
      );
    } else if (m.type === "rectangle") {
      const x = Math.min(m.start.x, m.end.x);
      const y = Math.min(m.start.y, m.end.y);
      const width = Math.abs(m.end.x - m.start.x);
      const height = Math.abs(m.end.y - m.start.y);
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const areaLabel = formatMeasurement(m.realArea, "mm²");
      const widthLabel = formatMeasurement(m.realWidth, "mm");
      const heightLabel = formatMeasurement(m.realHeight, "mm");

      return (
        <G key={m.id}>
          <Rect
            x={x}
            y={y}
            width={width}
            height={height}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="rgba(0,255,0,0.1)"
          />
          {/* Width label */}
          <Rect x={centerX - 30} y={y - 22} width={60} height={18} fill="rgba(0,0,0,0.7)" rx={3} />
          <SvgText x={centerX} y={y - 8} fill="#fff" fontSize={10} textAnchor="middle">
            {widthLabel}
          </SvgText>
          {/* Height label */}
          <Rect x={x + width + 4} y={centerY - 9} width={60} height={18} fill="rgba(0,0,0,0.7)" rx={3} />
          <SvgText x={x + width + 34} y={centerY + 4} fill="#fff" fontSize={10} textAnchor="middle">
            {heightLabel}
          </SvgText>
          {/* Area label */}
          <Rect x={centerX - 40} y={centerY - 12} width={80} height={24} fill="rgba(0,0,0,0.8)" rx={4} />
          <SvgText x={centerX} y={centerY + 5} fill="#fff" fontSize={12} fontWeight="bold" textAnchor="middle">
            {areaLabel}
          </SvgText>
        </G>
      );
    } else if (m.type === "polygon") {
      const pointsStr = m.points.map(p => `${p.x},${p.y}`).join(" ");
      const centroid = m.points.reduce(
        (acc, p) => ({ x: acc.x + p.x / m.points.length, y: acc.y + p.y / m.points.length }),
        { x: 0, y: 0 }
      );
      const areaLabel = formatMeasurement(m.realArea, "mm²");

      return (
        <G key={m.id}>
          <Polygon
            points={pointsStr}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="rgba(0,255,0,0.1)"
          />
          {m.points.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={5} fill={color} />
          ))}
          <Rect x={centroid.x - 40} y={centroid.y - 12} width={80} height={24} fill="rgba(0,0,0,0.8)" rx={4} />
          <SvgText x={centroid.x} y={centroid.y + 5} fill="#fff" fontSize={12} fontWeight="bold" textAnchor="middle">
            {areaLabel}
          </SvgText>
        </G>
      );
    }
    return null;
  };

  const renderCurrentDrawing = () => {
    if (currentPoints.length === 0) return null;

    const color = "#ffff00";
    const strokeWidth = 2;

    if (selectedTool === "line" && currentPoints.length === 2) {
      return (
        <G>
          <Line
            x1={currentPoints[0].x}
            y1={currentPoints[0].y}
            x2={currentPoints[1].x}
            y2={currentPoints[1].y}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray="5,5"
          />
          <Circle cx={currentPoints[0].x} cy={currentPoints[0].y} r={6} fill={color} />
          <Circle cx={currentPoints[1].x} cy={currentPoints[1].y} r={6} fill={color} />
        </G>
      );
    } else if (selectedTool === "rectangle" && currentPoints.length === 2) {
      const x = Math.min(currentPoints[0].x, currentPoints[1].x);
      const y = Math.min(currentPoints[0].y, currentPoints[1].y);
      const width = Math.abs(currentPoints[1].x - currentPoints[0].x);
      const height = Math.abs(currentPoints[1].y - currentPoints[0].y);
      return (
        <Rect
          x={x}
          y={y}
          width={width}
          height={height}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray="5,5"
          fill="rgba(255,255,0,0.1)"
        />
      );
    } else if (selectedTool === "polygon" && currentPoints.length > 0) {
      return (
        <G>
          {currentPoints.map((p, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <Line
                  x1={currentPoints[i - 1].x}
                  y1={currentPoints[i - 1].y}
                  x2={p.x}
                  y2={p.y}
                  stroke={color}
                  strokeWidth={strokeWidth}
                />
              )}
              <Circle cx={p.x} cy={p.y} r={6} fill={i === 0 ? "#00ff00" : color} />
            </React.Fragment>
          ))}
          {currentPoints.length >= 3 && (
            <Text style={styles.polygonHint}>Tap first point to close</Text>
          )}
        </G>
      );
    }
    return null;
  };

  const renderCalibrationLine = () => {
    if (!calibrationLine) return null;
    return (
      <G>
        <Line
          x1={calibrationLine.start.x}
          y1={calibrationLine.start.y}
          x2={calibrationLine.end.x}
          y2={calibrationLine.end.y}
          stroke="#ff00ff"
          strokeWidth={3}
        />
        <Circle cx={calibrationLine.start.x} cy={calibrationLine.start.y} r={8} fill="#ff00ff" />
        <Circle cx={calibrationLine.end.x} cy={calibrationLine.end.y} r={8} fill="#ff00ff" />
      </G>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Measure</Text>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* Calibration Status */}
      <View style={styles.calibrationBar}>
        {calibration ? (
          <View style={styles.calibrationStatus}>
            <View style={styles.calibratedDot} />
            <Text style={styles.calibrationText}>
              Calibrated: {calibration.referenceDescription}
            </Text>
          </View>
        ) : (
          <Text style={styles.uncalibratedText}>
            Not calibrated - measurements in pixels
          </Text>
        )}
        <TouchableOpacity
          style={[styles.calibrateButton, isCalibrating && styles.calibrateButtonActive]}
          onPress={() => {
            setIsCalibrating(!isCalibrating);
            setCalibrationLine(null);
            if (isDrawing) {
              setCurrentPoints([]);
              setIsDrawing(false);
            }
          }}
        >
          <Text style={styles.calibrateButtonText}>
            {isCalibrating ? "Cancel" : "Calibrate"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tool Selector */}
      {!isCalibrating && (
        <View style={styles.toolBar}>
          <TouchableOpacity
            style={[styles.toolButton, selectedTool === "line" && styles.toolButtonActive]}
            onPress={() => {
              setSelectedTool("line");
              setCurrentPoints([]);
              setIsDrawing(false);
            }}
          >
            <Text style={styles.toolButtonText}>📏 Line</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toolButton, selectedTool === "rectangle" && styles.toolButtonActive]}
            onPress={() => {
              setSelectedTool("rectangle");
              setCurrentPoints([]);
              setIsDrawing(false);
            }}
          >
            <Text style={styles.toolButtonText}>⬜ Area</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toolButton, selectedTool === "polygon" && styles.toolButtonActive]}
            onPress={() => {
              setSelectedTool("polygon");
              setCurrentPoints([]);
              setIsDrawing(false);
            }}
          >
            <Text style={styles.toolButtonText}>⬡ Polygon</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Canvas */}
      <View
        style={styles.canvasContainer}
        ref={viewShotRef}
        collapsable={false}
      >
        <Image
          source={{ uri: imageUri }}
          style={[styles.image, { width: imageSize.width, height: imageSize.height }]}
          resizeMode="contain"
          onLayout={handleImageLayout}
        />
        <View
          style={[styles.svgContainer, { width: imageSize.width, height: imageSize.height }]}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={selectedTool === "polygon" ? handlePolygonTap : handleTouchStart}
          onResponderMove={handleTouchMove}
          onResponderRelease={handleTouchEnd}
        >
          <Svg width={imageSize.width} height={imageSize.height}>
            {measurements.map(renderMeasurement)}
            {renderCurrentDrawing()}
            {renderCalibrationLine()}
          </Svg>
        </View>

        {/* Instructions Overlay */}
        {isCalibrating && (
          <View style={styles.instructionOverlay}>
            <Text style={styles.instructionText}>
              Draw a line along a known measurement{"\n"}
              (e.g., ruler, standard object)
            </Text>
          </View>
        )}
      </View>

      {/* Bottom Actions */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.actionButton, measurements.length === 0 && styles.actionButtonDisabled]}
          onPress={handleUndo}
          disabled={measurements.length === 0}
        >
          <Text style={styles.actionButtonText}>↩ Undo</Text>
        </TouchableOpacity>

        <Text style={styles.measurementCount}>
          {measurements.length} measurement{measurements.length !== 1 ? "s" : ""}
        </Text>

        <TouchableOpacity
          style={[styles.actionButton, measurements.length === 0 && styles.actionButtonDisabled]}
          onPress={handleClearAll}
          disabled={measurements.length === 0}
        >
          <Text style={styles.actionButtonText}>Clear All</Text>
        </TouchableOpacity>
      </View>

      {/* Calibration Modal */}
      <Modal
        visible={showCalibrationModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowCalibrationModal(false);
          setCalibrationLine(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Reference Measurement</Text>
            <Text style={styles.modalSubtitle}>
              Enter the real-world length of the line you drew
            </Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={calibrationValue}
                onChangeText={setCalibrationValue}
                placeholder="Length"
                keyboardType="numeric"
                autoFocus
              />
              <Text style={styles.inputUnit}>mm</Text>
            </View>

            <TextInput
              style={styles.descriptionInput}
              value={calibrationDescription}
              onChangeText={setCalibrationDescription}
              placeholder="Description (e.g., 'Ruler 100mm mark')"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowCalibrationModal(false);
                  setCalibrationLine(null);
                  setCalibrationValue("");
                  setCalibrationDescription("");
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleCalibrationSave}
              >
                <Text style={styles.modalSaveText}>Calibrate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#2a2a2a",
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelButtonText: {
    color: "#888",
    fontSize: 16,
  },
  title: {
    color: "#fff",
    fontSize: 18,
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
    fontSize: 16,
    fontWeight: "600",
  },
  calibrationBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#222",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  calibrationStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  calibratedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22c55e",
  },
  calibrationText: {
    color: "#22c55e",
    fontSize: 12,
  },
  uncalibratedText: {
    color: "#f59e0b",
    fontSize: 12,
  },
  calibrateButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#333",
    borderRadius: 4,
  },
  calibrateButtonActive: {
    backgroundColor: "#ff00ff",
  },
  calibrateButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  toolBar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 12,
    backgroundColor: "#222",
  },
  toolButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#333",
    borderRadius: 20,
  },
  toolButtonActive: {
    backgroundColor: "#2d5c8f",
  },
  toolButtonText: {
    color: "#fff",
    fontSize: 14,
  },
  canvasContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  image: {
    position: "absolute",
  },
  svgContainer: {
    position: "absolute",
  },
  instructionOverlay: {
    position: "absolute",
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: "rgba(255,0,255,0.2)",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ff00ff",
  },
  instructionText: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
  },
  polygonHint: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    color: "#00ff00",
    fontSize: 14,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#2a2a2a",
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 14,
  },
  measurementCount: {
    color: "#888",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 340,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    color: "#888",
    fontSize: 14,
    marginBottom: 20,
    textAlign: "center",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  input: {
    flex: 1,
    backgroundColor: "#333",
    color: "#fff",
    fontSize: 24,
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    textAlign: "center",
  },
  inputUnit: {
    color: "#888",
    fontSize: 18,
    marginLeft: 12,
  },
  descriptionInput: {
    backgroundColor: "#333",
    color: "#fff",
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: "#444",
    borderRadius: 8,
    alignItems: "center",
  },
  modalCancelText: {
    color: "#fff",
    fontSize: 16,
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: "#ff00ff",
    borderRadius: 8,
    alignItems: "center",
  },
  modalSaveText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default MeasurementTool;

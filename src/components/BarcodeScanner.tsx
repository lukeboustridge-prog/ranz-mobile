/**
 * BarcodeScanner Component
 * Scan barcodes and QR codes for product codes, consent numbers, etc.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Vibration,
  Alert,
  FlatList,
  Clipboard,
} from "react-native";
import { CameraView, BarcodeScanningResult } from "expo-camera";

// ============================================
// TYPES
// ============================================

export interface ScannedBarcode {
  id: string;
  type: string;
  data: string;
  scannedAt: string;
}

export type BarcodeType =
  | "aztec"
  | "codabar"
  | "code39"
  | "code93"
  | "code128"
  | "datamatrix"
  | "ean8"
  | "ean13"
  | "itf14"
  | "pdf417"
  | "qr"
  | "upc_a"
  | "upc_e";

interface BarcodeScannerProps {
  onScan: (barcode: ScannedBarcode) => void;
  onClose: () => void;
  allowedTypes?: BarcodeType[];
  title?: string;
  subtitle?: string;
}

// ============================================
// CONSTANTS
// ============================================

const BARCODE_TYPE_LABELS: Record<string, string> = {
  aztec: "Aztec",
  codabar: "Codabar",
  code39: "Code 39",
  code93: "Code 93",
  code128: "Code 128",
  datamatrix: "Data Matrix",
  ean8: "EAN-8",
  ean13: "EAN-13",
  itf14: "ITF-14",
  pdf417: "PDF417",
  qr: "QR Code",
  upc_a: "UPC-A",
  upc_e: "UPC-E",
};

const DEFAULT_ALLOWED_TYPES: BarcodeType[] = [
  "qr",
  "ean13",
  "ean8",
  "code128",
  "code39",
  "upc_a",
  "upc_e",
  "datamatrix",
  "pdf417",
];

// ============================================
// COMPONENT
// ============================================

export function BarcodeScanner({
  onScan,
  onClose,
  allowedTypes = DEFAULT_ALLOWED_TYPES,
  title = "Scan Barcode",
  subtitle = "Point camera at barcode or QR code",
}: BarcodeScannerProps) {
  const [scanned, setScanned] = useState(false);
  const [lastScanned, setLastScanned] = useState<ScannedBarcode | null>(null);
  const [recentScans, setRecentScans] = useState<ScannedBarcode[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // Reset scanned state after delay to allow re-scanning
  useEffect(() => {
    if (scanned) {
      const timer = setTimeout(() => {
        setScanned(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [scanned]);

  const handleBarCodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (scanned) return;

      const { type, data } = result;

      // Vibrate on successful scan
      Vibration.vibrate(100);

      const barcode: ScannedBarcode = {
        id: `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        data,
        scannedAt: new Date().toISOString(),
      };

      setScanned(true);
      setLastScanned(barcode);
      setRecentScans((prev) => [barcode, ...prev.slice(0, 9)]); // Keep last 10
    },
    [scanned]
  );

  const handleUseBarcode = () => {
    if (lastScanned) {
      onScan(lastScanned);
    }
  };

  const handleCopyToClipboard = () => {
    if (lastScanned) {
      Clipboard.setString(lastScanned.data);
      Alert.alert("Copied", "Barcode data copied to clipboard");
    }
  };

  const handleScanAgain = () => {
    setLastScanned(null);
    setScanned(false);
  };

  const handleSelectFromHistory = (barcode: ScannedBarcode) => {
    setLastScanned(barcode);
    setShowHistory(false);
  };

  const renderHistoryItem = ({ item }: { item: ScannedBarcode }) => {
    const scannedDate = new Date(item.scannedAt);
    return (
      <TouchableOpacity
        style={styles.historyItem}
        onPress={() => handleSelectFromHistory(item)}
      >
        <View style={styles.historyItemContent}>
          <Text style={styles.historyItemType}>
            {BARCODE_TYPE_LABELS[item.type] || item.type}
          </Text>
          <Text style={styles.historyItemData} numberOfLines={1}>
            {item.data}
          </Text>
        </View>
        <Text style={styles.historyItemTime}>
          {scannedDate.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Camera View */}
      <CameraView
        style={styles.camera}
        facing="back"
        enableTorch={torchOn}
        barcodeScannerSettings={{
          barcodeTypes: allowedTypes,
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          <TouchableOpacity
            style={[styles.torchButton, torchOn && styles.torchButtonOn]}
            onPress={() => setTorchOn(!torchOn)}
          >
            <Text style={styles.torchButtonText}>{torchOn ? "🔦" : "💡"}</Text>
          </TouchableOpacity>
        </View>

        {/* Scan Frame */}
        <View style={styles.scanFrameContainer}>
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />

            {/* Scan Line Animation */}
            {!scanned && <View style={styles.scanLine} />}
          </View>
        </View>

        {/* Result Panel */}
        {lastScanned && (
          <View style={styles.resultPanel}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultType}>
                {BARCODE_TYPE_LABELS[lastScanned.type] || lastScanned.type}
              </Text>
              <TouchableOpacity
                style={styles.scanAgainButton}
                onPress={handleScanAgain}
              >
                <Text style={styles.scanAgainText}>Scan Again</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.resultData} selectable>
              {lastScanned.data}
            </Text>

            <View style={styles.resultActions}>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={handleCopyToClipboard}
              >
                <Text style={styles.copyButtonText}>Copy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.useButton}
                onPress={handleUseBarcode}
              >
                <Text style={styles.useButtonText}>Use This Code</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          {recentScans.length > 0 && (
            <TouchableOpacity
              style={styles.historyButton}
              onPress={() => setShowHistory(!showHistory)}
            >
              <Text style={styles.historyButtonText}>
                History ({recentScans.length})
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </CameraView>

      {/* History Panel */}
      {showHistory && (
        <View style={styles.historyPanel}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Recent Scans</Text>
            <TouchableOpacity onPress={() => setShowHistory(false)}>
              <Text style={styles.historyClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={recentScans}
            keyExtractor={(item) => item.id}
            renderItem={renderHistoryItem}
            style={styles.historyList}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 20,
  },
  titleContainer: {
    alignItems: "center",
    flex: 1,
    paddingHorizontal: 8,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  subtitle: {
    color: "#ccc",
    fontSize: 12,
    marginTop: 4,
  },
  torchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  torchButtonOn: {
    backgroundColor: "rgba(255,200,0,0.5)",
  },
  torchButtonText: {
    fontSize: 18,
  },
  scanFrameContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scanFrame: {
    width: 280,
    height: 280,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 40,
    height: 40,
    borderColor: "#3c4b5d",
    borderWidth: 4,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scanLine: {
    position: "absolute",
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: "#3c4b5d",
    top: "50%",
  },
  resultPanel: {
    position: "absolute",
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.9)",
    borderRadius: 12,
    padding: 16,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  resultType: {
    color: "#3c4b5d",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  scanAgainButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  scanAgainText: {
    color: "#888",
    fontSize: 12,
  },
  resultData: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 16,
    fontFamily: "monospace",
  },
  resultActions: {
    flexDirection: "row",
    gap: 12,
  },
  copyButton: {
    flex: 1,
    backgroundColor: "#333",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  copyButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  useButton: {
    flex: 2,
    backgroundColor: "#3c4b5d",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  useButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  historyButton: {
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  historyButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  historyPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "50%",
    backgroundColor: "#1c1c1e",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  historyTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  historyClose: {
    color: "#fff",
    fontSize: 20,
    padding: 4,
  },
  historyList: {
    maxHeight: 300,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  historyItemContent: {
    flex: 1,
  },
  historyItemType: {
    color: "#888",
    fontSize: 11,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  historyItemData: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "monospace",
  },
  historyItemTime: {
    color: "#666",
    fontSize: 12,
    marginLeft: 12,
  },
});

export default BarcodeScanner;

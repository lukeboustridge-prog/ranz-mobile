/**
 * VoiceNoteRecorder Component
 * Compact audio recording interface for capturing voice observations
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
} from "react-native";
import {
  voiceNoteService,
  formatVoiceNoteDuration,
  type VoiceNoteMetadata,
} from "../services/voice-note-service";

interface VoiceNoteRecorderProps {
  reportId: string;
  defectId?: string;
  roofElementId?: string;
  onRecordingComplete?: (voiceNote: VoiceNoteMetadata) => void;
  onDelete?: (id: string) => void;
  showList?: boolean;
}

export function VoiceNoteRecorder({
  reportId,
  defectId,
  roofElementId,
  onRecordingComplete,
  onDelete,
  showList = true,
}: VoiceNoteRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [voiceNotes, setVoiceNotes] = useState<VoiceNoteMetadata[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load existing voice notes
  const loadVoiceNotes = useCallback(async () => {
    if (!showList) return;

    try {
      let notes: VoiceNoteMetadata[];
      if (defectId) {
        notes = await voiceNoteService.getVoiceNotesForDefect(defectId);
      } else {
        notes = await voiceNoteService.getVoiceNotesForReport(reportId);
      }
      setVoiceNotes(notes);
    } catch (error) {
      console.error("Failed to load voice notes:", error);
    }
  }, [reportId, defectId, showList]);

  useEffect(() => {
    loadVoiceNotes();
  }, [loadVoiceNotes]);

  // Set up recording progress callback
  useEffect(() => {
    voiceNoteService.onRecordingProgress((durationMs) => {
      setRecordingDuration(durationMs);
    });
  }, []);

  const handleStartRecording = async () => {
    setIsLoading(true);
    try {
      const started = await voiceNoteService.startRecording(
        reportId,
        defectId,
        roofElementId
      );
      if (started) {
        setIsRecording(true);
        setRecordingDuration(0);
      } else {
        Alert.alert(
          "Permission Required",
          "Please grant microphone permission to record voice notes."
        );
      }
    } catch (error) {
      Alert.alert("Error", "Failed to start recording");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopRecording = async () => {
    setIsLoading(true);
    try {
      const result = await voiceNoteService.stopRecording(
        reportId,
        defectId,
        roofElementId
      );
      setIsRecording(false);
      setRecordingDuration(0);

      if (result.success && result.metadata) {
        onRecordingComplete?.(result.metadata);
        await loadVoiceNotes();
      } else {
        Alert.alert("Error", result.error || "Failed to save recording");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to stop recording");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelRecording = async () => {
    await voiceNoteService.cancelRecording();
    setIsRecording(false);
    setRecordingDuration(0);
  };

  const handlePlayPause = async (voiceNote: VoiceNoteMetadata) => {
    try {
      if (playingId === voiceNote.id) {
        await voiceNoteService.stopPlayback();
        setPlayingId(null);
      } else {
        await voiceNoteService.playVoiceNote(voiceNote.localUri);
        setPlayingId(voiceNote.id);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to play voice note");
    }
  };

  const handleDelete = async (voiceNote: VoiceNoteMetadata) => {
    Alert.alert(
      "Delete Voice Note",
      "Are you sure you want to delete this recording?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await voiceNoteService.deleteVoiceNote(voiceNote.id, voiceNote.localUri);
              onDelete?.(voiceNote.id);
              await loadVoiceNotes();
            } catch (error) {
              Alert.alert("Error", "Failed to delete voice note");
            }
          },
        },
      ]
    );
  };

  const renderVoiceNote = ({ item }: { item: VoiceNoteMetadata }) => {
    const isPlaying = playingId === item.id;
    const recordedDate = new Date(item.recordedAt);

    return (
      <View style={styles.voiceNoteItem}>
        <TouchableOpacity
          style={[styles.playButton, isPlaying && styles.playButtonActive]}
          onPress={() => handlePlayPause(item)}
        >
          <Text style={styles.playButtonText}>{isPlaying ? "||" : "\u25B6"}</Text>
        </TouchableOpacity>

        <View style={styles.voiceNoteInfo}>
          <Text style={styles.voiceNoteDuration}>
            {formatVoiceNoteDuration(item.durationMs)}
          </Text>
          <Text style={styles.voiceNoteDate}>
            {recordedDate.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item)}
        >
          <Text style={styles.deleteButtonText}>X</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Recording Controls */}
      <View style={styles.recordingControls}>
        {isRecording ? (
          <>
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingTime}>
                {formatVoiceNoteDuration(recordingDuration)}
              </Text>
            </View>

            <View style={styles.recordingActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelRecording}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.stopButton}
                onPress={handleStopRecording}
                disabled={isLoading}
              >
                <View style={styles.stopButtonInner} />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.recordButton, isLoading && styles.recordButtonDisabled]}
            onPress={handleStartRecording}
            disabled={isLoading}
          >
            <View style={styles.micIcon}>
              <Text style={styles.micIconText}>mic</Text>
            </View>
            <Text style={styles.recordButtonText}>
              {isLoading ? "..." : "Record Voice Note"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Voice Notes List */}
      {showList && voiceNotes.length > 0 && (
        <View style={styles.voiceNotesList}>
          <Text style={styles.listTitle}>
            Voice Notes ({voiceNotes.length})
          </Text>
          <FlatList
            data={voiceNotes}
            keyExtractor={(item) => item.id}
            renderItem={renderVoiceNote}
            scrollEnabled={false}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  recordingControls: {
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 16,
  },
  recordButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3c4b5d",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  recordButtonDisabled: {
    opacity: 0.6,
  },
  micIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  micIconText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  recordButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  recordingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    gap: 8,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#ef4444",
  },
  recordingTime: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    fontVariant: ["tabular-nums"],
  },
  recordingActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "500",
  },
  stopButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
  },
  stopButtonInner: {
    width: 20,
    height: 20,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  voiceNotesList: {
    marginTop: 16,
  },
  listTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  voiceNoteItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#3c4b5d",
    justifyContent: "center",
    alignItems: "center",
  },
  playButtonActive: {
    backgroundColor: "#f59e0b",
  },
  playButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  voiceNoteInfo: {
    flex: 1,
    marginLeft: 12,
  },
  voiceNoteDuration: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  voiceNoteDate: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fee2e2",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteButtonText: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "700",
  },
});

export default VoiceNoteRecorder;

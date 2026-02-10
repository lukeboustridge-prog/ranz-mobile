/**
 * Voice Note Service
 * Audio recording and playback for inspection observations
 *
 * EVIDENCE INTEGRITY: Voice notes for inspection observations must have
 * forensic integrity for legal proceedings. SHA-256 hash is generated
 * BEFORE any file operations to ensure the hash reflects original data.
 */

import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";
import {
  documentDirectory,
  makeDirectoryAsync,
  getInfoAsync,
  deleteAsync,
  readAsStringAsync,
  EncodingType,
} from "expo-file-system/legacy";
import {
  saveVoiceNote,
  getVoiceNotesForReport,
  getVoiceNotesForDefect,
  deleteVoiceNote as deleteVoiceNoteFromDb,
  markReportDirty,
} from "../lib/sqlite";
import { generateHashFromBase64 } from "./evidence-service";
import { logCapture, logStorage } from "./chain-of-custody";
import type { LocalVoiceNote } from "../types/database";

// ============================================
// TYPES
// ============================================

export interface VoiceNoteMetadata {
  id: string;
  reportId: string;
  defectId: string | null;
  roofElementId: string | null;
  localUri: string;
  filename: string;
  durationMs: number;
  recordedAt: string;
  transcription: string | null;
  originalHash?: string;
}

export interface RecordingResult {
  success: boolean;
  metadata?: VoiceNoteMetadata;
  error?: string;
}

type RecordingProgressCallback = (durationMs: number) => void;

// ============================================
// VOICE NOTE SERVICE CLASS
// ============================================

class VoiceNoteService {
  private recording: Audio.Recording | null = null;
  private sound: Audio.Sound | null = null;
  private isRecording: boolean = false;
  private recordingStartTime: number = 0;
  private progressCallback: RecordingProgressCallback | null = null;
  private progressInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Request microphone permission
   */
  async requestPermission(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      return status === "granted";
    } catch (error) {
      console.error("[VoiceNoteService] Permission error:", error);
      return false;
    }
  }

  /**
   * Register progress callback for recording duration updates
   */
  onRecordingProgress(callback: RecordingProgressCallback): void {
    this.progressCallback = callback;
  }

  /**
   * Start recording audio
   */
  async startRecording(
    reportId: string,
    defectId?: string,
    roofElementId?: string
  ): Promise<boolean> {
    if (this.isRecording) {
      console.warn("[VoiceNoteService] Already recording");
      return false;
    }

    try {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        console.warn("[VoiceNoteService] Microphone permission not granted");
        return false;
      }

      // Configure audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        playsInSilentModeIOS: true,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Create recording with high quality settings
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      this.recording = recording;
      this.isRecording = true;
      this.recordingStartTime = Date.now();

      // Start progress updates
      if (this.progressCallback) {
        this.progressInterval = setInterval(() => {
          const durationMs = Date.now() - this.recordingStartTime;
          this.progressCallback?.(durationMs);
        }, 100);
      }

      console.log("[VoiceNoteService] Recording started");
      return true;
    } catch (error) {
      console.error("[VoiceNoteService] Failed to start recording:", error);
      return false;
    }
  }

  /**
   * Stop recording and save the audio file
   */
  async stopRecording(
    reportId: string,
    defectId?: string,
    roofElementId?: string
  ): Promise<RecordingResult> {
    if (!this.recording || !this.isRecording) {
      return { success: false, error: "No active recording" };
    }

    try {
      // Stop progress updates
      if (this.progressInterval) {
        clearInterval(this.progressInterval);
        this.progressInterval = null;
      }

      // Stop and unload the recording
      await this.recording.stopAndUnloadAsync();

      // Get recording status for duration
      const status = await this.recording.getStatusAsync();
      const durationMs = status.durationMillis || 0;

      // Get the URI of the recorded file
      const uri = this.recording.getURI();
      if (!uri) {
        throw new Error("Recording URI not available");
      }

      // =========================================
      // EVIDENCE INTEGRITY: Hash BEFORE any file operations
      // =========================================
      const base64Content = await readAsStringAsync(uri, {
        encoding: EncodingType.Base64,
      });
      const hashResult = await generateHashFromBase64(base64Content);
      const originalHash = hashResult.hash;

      // Generate unique ID and filename
      const id = `voice_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const filename = `${id}.m4a`;
      const timestamp = new Date().toISOString();

      // Ensure voice_notes directory exists
      const voiceNotesDir = `${documentDirectory}voice_notes`;
      const dirInfo = await getInfoAsync(voiceNotesDir);
      if (!dirInfo.exists) {
        await makeDirectoryAsync(voiceNotesDir, { intermediates: true });
      }

      // Move to permanent location
      const localUri = `${voiceNotesDir}/${filename}`;

      // Copy the file (move doesn't work well with recordings)
      const response = await fetch(uri);
      const blob = await response.blob();
      const reader = new FileReader();

      await new Promise<void>((resolve, reject) => {
        reader.onloadend = () => resolve();
        reader.onerror = () => reject(new Error("Failed to read recording"));
        reader.readAsDataURL(blob);
      });

      // For expo-file-system, we need to use the original URI
      // The recording is already saved by expo-av
      const fileInfo = await getInfoAsync(uri);
      const fileSize = (fileInfo as { size?: number }).size || 0;

      // Build metadata
      const metadata: VoiceNoteMetadata = {
        id,
        reportId,
        defectId: defectId || null,
        roofElementId: roofElementId || null,
        localUri: uri, // Use the recording's original URI
        filename,
        durationMs,
        recordedAt: timestamp,
        transcription: null,
        originalHash,
      };

      // Save to database
      const localVoiceNote: LocalVoiceNote = {
        id,
        reportId,
        defectId: defectId || null,
        roofElementId: roofElementId || null,
        localUri: uri,
        filename,
        mimeType: "audio/m4a",
        fileSize,
        durationMs,
        recordedAt: timestamp,
        transcription: null,
        originalHash,
        syncStatus: "draft",
        uploadedUrl: null,
        syncedAt: null,
        lastSyncError: null,
        createdAt: timestamp,
      };

      await saveVoiceNote(localVoiceNote);

      // =========================================
      // CHAIN OF CUSTODY: Log capture and storage events
      // =========================================
      const userId = "local-user"; // TODO: Get from auth context
      const userName = "Inspector"; // TODO: Get from auth context

      await logCapture(
        "voice_note",
        id,
        userId,
        userName,
        originalHash,
        `Voice note recorded: ${this.formatDuration(durationMs)}`
      );

      await logStorage(
        "voice_note",
        id,
        userId,
        userName,
        originalHash,
        uri
      );

      // Mark report as needing sync
      await markReportDirty(reportId);

      console.log("[VoiceNoteService] Recording saved:", {
        id,
        durationMs,
        fileSize,
        originalHash: originalHash.substring(0, 16) + "...",
      });

      // Reset state
      this.recording = null;
      this.isRecording = false;

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
        playsInSilentModeIOS: true,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      return { success: true, metadata };
    } catch (error) {
      console.error("[VoiceNoteService] Failed to stop recording:", error);
      this.recording = null;
      this.isRecording = false;
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save recording",
      };
    }
  }

  /**
   * Cancel and discard current recording
   */
  async cancelRecording(): Promise<void> {
    if (!this.recording || !this.isRecording) return;

    try {
      if (this.progressInterval) {
        clearInterval(this.progressInterval);
        this.progressInterval = null;
      }

      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      if (uri) {
        await deleteAsync(uri, { idempotent: true });
      }
    } catch (error) {
      console.error("[VoiceNoteService] Failed to cancel recording:", error);
    } finally {
      this.recording = null;
      this.isRecording = false;
    }
  }

  /**
   * Play a voice note
   */
  async playVoiceNote(localUri: string): Promise<void> {
    try {
      // Stop any existing playback
      await this.stopPlayback();

      // Load and play the audio
      const { sound } = await Audio.Sound.createAsync(
        { uri: localUri },
        { shouldPlay: true }
      );

      this.sound = sound;

      // Set up completion handler
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          this.stopPlayback();
        }
      });

      console.log("[VoiceNoteService] Playing voice note");
    } catch (error) {
      console.error("[VoiceNoteService] Failed to play voice note:", error);
      throw error;
    }
  }

  /**
   * Stop playback
   */
  async stopPlayback(): Promise<void> {
    if (this.sound) {
      try {
        await this.sound.stopAsync();
        await this.sound.unloadAsync();
      } catch (error) {
        console.error("[VoiceNoteService] Error stopping playback:", error);
      }
      this.sound = null;
    }
  }

  /**
   * Check if currently recording
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Get voice notes for a report
   */
  async getVoiceNotesForReport(reportId: string): Promise<VoiceNoteMetadata[]> {
    const notes = await getVoiceNotesForReport(reportId);
    return notes.map((n) => ({
      id: n.id,
      reportId: n.reportId,
      defectId: n.defectId,
      roofElementId: n.roofElementId,
      localUri: n.localUri,
      filename: n.filename,
      durationMs: n.durationMs,
      recordedAt: n.recordedAt,
      transcription: n.transcription,
      originalHash: n.originalHash,
    }));
  }

  /**
   * Get voice notes for a defect
   */
  async getVoiceNotesForDefect(defectId: string): Promise<VoiceNoteMetadata[]> {
    const notes = await getVoiceNotesForDefect(defectId);
    return notes.map((n) => ({
      id: n.id,
      reportId: n.reportId,
      defectId: n.defectId,
      roofElementId: n.roofElementId,
      localUri: n.localUri,
      filename: n.filename,
      durationMs: n.durationMs,
      recordedAt: n.recordedAt,
      transcription: n.transcription,
      originalHash: n.originalHash,
    }));
  }

  /**
   * Delete a voice note
   */
  async deleteVoiceNote(id: string, localUri: string, reportId?: string): Promise<void> {
    try {
      // Delete from file system
      await deleteAsync(localUri, { idempotent: true });

      // Delete from database
      await deleteVoiceNoteFromDb(id);

      // Mark report as needing sync
      if (reportId) {
        await markReportDirty(reportId);
      }

      console.log("[VoiceNoteService] Voice note deleted:", id);
    } catch (error) {
      console.error("[VoiceNoteService] Failed to delete voice note:", error);
      throw error;
    }
  }

  /**
   * Format duration for display (mm:ss)
   */
  formatDuration(durationMs: number): string {
    const totalSeconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }
}

// Export singleton instance
export const voiceNoteService = new VoiceNoteService();

// Export convenience functions
export async function requestMicrophonePermission(): Promise<boolean> {
  return voiceNoteService.requestPermission();
}

export function formatVoiceNoteDuration(durationMs: number): string {
  return voiceNoteService.formatDuration(durationMs);
}

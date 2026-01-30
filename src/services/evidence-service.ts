/**
 * Evidence Service
 * Core evidence integrity primitives for forensic photo/video capture
 *
 * CRITICAL: Hash must be generated BEFORE any file operations (move/copy)
 * to ensure the hash reflects the original captured data. This is essential
 * for court-admissible evidence under the NZ Evidence Act 2006.
 *
 * Usage pattern:
 * 1. Capture photo/video
 * 2. Read as base64 IMMEDIATELY
 * 3. Generate hash from base64 content
 * 4. THEN perform file operations (copy to originals, etc.)
 *
 * This ensures the hash is generated from the exact bytes captured,
 * before any filesystem operations that could theoretically modify data.
 */

import * as Crypto from "expo-crypto";
import { readFileAsBase64, getFileInfo } from "../lib/file-storage";
import type { HashResult, VerificationResult } from "../types/evidence";

/**
 * Generate SHA-256 hash from a base64-encoded string
 *
 * Use this when you have the file content already loaded (e.g., right after capture).
 * This is the preferred method as it ensures hashing happens BEFORE file operations.
 *
 * @param base64Content - The file content as base64 string
 * @returns HashResult with the SHA-256 hash and metadata
 *
 * @example
 * ```typescript
 * // Right after camera capture, read the file and hash immediately
 * const base64 = await FileSystem.readAsStringAsync(tempUri, {
 *   encoding: FileSystem.EncodingType.Base64,
 * });
 * const hashResult = await generateHashFromBase64(base64);
 * // NOW it's safe to move/copy the file
 * ```
 */
export async function generateHashFromBase64(base64Content: string): Promise<HashResult> {
  const timestamp = new Date().toISOString();

  // expo-crypto digestStringAsync computes SHA-256 of the string
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    base64Content
  );

  // Calculate byte length from base64
  // Base64 encoding adds ~33% overhead, so actual bytes = length * 3/4
  // Subtract padding characters ('=') from calculation
  const paddingChars = (base64Content.match(/=/g) || []).length;
  const byteLength = Math.floor((base64Content.length * 3) / 4) - paddingChars;

  return {
    hash,
    algorithm: "SHA-256",
    timestamp,
    byteLength,
  };
}

/**
 * Generate SHA-256 hash from a file path
 *
 * Use this when you need to hash an existing file. Note that this reads
 * the file from disk, so if the file was modified after initial write,
 * the hash will reflect the modified content.
 *
 * For new captures, prefer generateHashFromBase64() with the content
 * read immediately after capture.
 *
 * @param filePath - Absolute path to the file
 * @returns HashResult with the SHA-256 hash and metadata
 *
 * @example
 * ```typescript
 * // Hash an existing file
 * const hashResult = await generateFileHash('/path/to/evidence.jpg');
 * console.log(hashResult.hash); // 64-character hex string
 * ```
 */
export async function generateFileHash(filePath: string): Promise<HashResult> {
  const base64Content = await readFileAsBase64(filePath);
  const result = await generateHashFromBase64(base64Content);

  // Get actual file size from filesystem (more accurate than base64 calculation)
  const fileInfo = await getFileInfo(filePath);
  if (fileInfo.size !== null) {
    result.byteLength = fileInfo.size;
  }

  return result;
}

/**
 * Verify a file's hash matches the expected hash
 *
 * Use this to verify evidence integrity hasn't been compromised.
 * Returns a VerificationResult indicating whether the hashes match.
 *
 * @param filePath - Path to the file to verify
 * @param expectedHash - The expected SHA-256 hash (64-character hex string)
 * @returns VerificationResult indicating if hashes match
 *
 * @example
 * ```typescript
 * const result = await verifyFileHash('/path/to/evidence.jpg', storedHash);
 * if (!result.isValid) {
 *   console.error('Evidence integrity compromised!');
 *   console.error(`Expected: ${result.expectedHash}`);
 *   console.error(`Actual: ${result.actualHash}`);
 * }
 * ```
 */
export async function verifyFileHash(
  filePath: string,
  expectedHash: string
): Promise<VerificationResult> {
  const result = await generateFileHash(filePath);

  return {
    isValid: result.hash === expectedHash,
    expectedHash,
    actualHash: result.hash,
    verifiedAt: new Date().toISOString(),
  };
}

/**
 * Evidence Service class for stateful operations
 *
 * Provides a singleton instance for managing evidence integrity.
 * Use the singleton export `evidenceService` for convenience.
 */
export class EvidenceService {
  private static instance: EvidenceService;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): EvidenceService {
    if (!EvidenceService.instance) {
      EvidenceService.instance = new EvidenceService();
    }
    return EvidenceService.instance;
  }

  /**
   * Hash content immediately after capture
   *
   * CRITICAL: Call this BEFORE any file move/copy operations
   * to ensure the hash reflects the original captured data.
   *
   * @param base64Content - The captured content as base64 string
   * @returns HashResult with hash and metadata
   */
  async hashCapturedContent(base64Content: string): Promise<HashResult> {
    return generateHashFromBase64(base64Content);
  }

  /**
   * Hash an existing file
   *
   * @param filePath - Absolute path to the file
   * @returns HashResult with hash and metadata
   */
  async hashFile(filePath: string): Promise<HashResult> {
    return generateFileHash(filePath);
  }

  /**
   * Verify file integrity against expected hash
   *
   * @param filePath - Path to the file to verify
   * @param expectedHash - The expected SHA-256 hash
   * @returns VerificationResult with match status
   */
  async verifyIntegrity(filePath: string, expectedHash: string): Promise<VerificationResult> {
    return verifyFileHash(filePath, expectedHash);
  }

  /**
   * Batch verify multiple files
   *
   * Useful for verifying all evidence in a report before submission.
   *
   * @param files - Array of {path, expectedHash} objects
   * @returns Array of VerificationResult objects
   */
  async batchVerify(
    files: Array<{ path: string; expectedHash: string }>
  ): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];

    for (const file of files) {
      const result = await this.verifyIntegrity(file.path, file.expectedHash);
      results.push(result);
    }

    return results;
  }

  /**
   * Check if all files in a batch are valid
   *
   * @param files - Array of {path, expectedHash} objects
   * @returns True if all files pass verification
   */
  async allValid(files: Array<{ path: string; expectedHash: string }>): Promise<boolean> {
    const results = await this.batchVerify(files);
    return results.every((r) => r.isValid);
  }
}

// Export singleton for convenience
export const evidenceService = EvidenceService.getInstance();

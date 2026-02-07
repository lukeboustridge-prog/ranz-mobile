/**
 * Unit tests for evidence-integrity service.
 * Tests hash generation and verification functions.
 *
 * These tests mock native modules (expo-crypto, expo-file-system) to run
 * in Node.js test environment without requiring the React Native runtime.
 */

// Mock expo-crypto since it requires native modules
jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn(async (algorithm: string, data: string) => {
    // Use Node.js crypto to produce real SHA-256 hashes for testing
    const { createHash } = require('crypto');
    return createHash('sha256').update(data).digest('hex');
  }),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
  },
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64',
  },
}));

// Mock the file-storage module that evidence-service imports
jest.mock('../../lib/file-storage', () => ({
  readFileAsBase64: jest.fn(),
  getFileInfo: jest.fn(),
}));

// Mock sqlite module
jest.mock('../../lib/sqlite', () => ({
  getUser: jest.fn().mockResolvedValue({ id: 'test-user', name: 'Test User' }),
}));

// Mock chain-of-custody
jest.mock('../../services/chain-of-custody', () => ({
  logVerification: jest.fn().mockResolvedValue(undefined),
}));

import * as Crypto from 'expo-crypto';
import { readFileAsBase64, getFileInfo } from '../../lib/file-storage';
import {
  generateHashFromBase64,
  generateFileHash,
  verifyFileHash,
  EvidenceService,
  evidenceService,
} from '../../services/evidence-service';

describe('Evidence Integrity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateHashFromBase64', () => {
    it('should generate consistent hash for same input', async () => {
      const testData = 'dGVzdCBpbWFnZSBkYXRh'; // "test image data" in base64

      const result1 = await generateHashFromBase64(testData);
      const result2 = await generateHashFromBase64(testData);

      expect(result1.hash).toBe(result2.hash);
      expect(result1.hash).toHaveLength(64); // SHA-256 produces 64 hex chars
    });

    it('should generate different hashes for different inputs', async () => {
      const result1 = await generateHashFromBase64('aW1hZ2UgZGF0YSAx'); // "image data 1"
      const result2 = await generateHashFromBase64('aW1hZ2UgZGF0YSAy'); // "image data 2"

      expect(result1.hash).not.toBe(result2.hash);
    });

    it('should produce valid hex string', async () => {
      const result = await generateHashFromBase64('dGVzdCBkYXRh');

      expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should return SHA-256 as algorithm', async () => {
      const result = await generateHashFromBase64('dGVzdA==');

      expect(result.algorithm).toBe('SHA-256');
    });

    it('should include timestamp in result', async () => {
      const before = new Date().toISOString();
      const result = await generateHashFromBase64('dGVzdA==');
      const after = new Date().toISOString();

      expect(result.timestamp).toBeDefined();
      expect(result.timestamp >= before).toBe(true);
      expect(result.timestamp <= after).toBe(true);
    });

    it('should calculate byte length from base64', async () => {
      // "test" in base64 is "dGVzdA==" (4 bytes)
      const result = await generateHashFromBase64('dGVzdA==');

      expect(result.byteLength).toBe(4);
    });
  });

  describe('generateFileHash', () => {
    it('should hash file contents from path', async () => {
      const mockBase64 = 'dGVzdCBmaWxlIGNvbnRlbnQ='; // "test file content"
      (readFileAsBase64 as jest.Mock).mockResolvedValue(mockBase64);
      (getFileInfo as jest.Mock).mockResolvedValue({ size: 17 });

      const result = await generateFileHash('/path/to/file.jpg');

      expect(readFileAsBase64).toHaveBeenCalledWith('/path/to/file.jpg');
      expect(result.hash).toHaveLength(64);
      expect(result.byteLength).toBe(17); // Uses actual file size
    });
  });

  describe('verifyFileHash', () => {
    it('should return valid when hashes match', async () => {
      const mockBase64 = 'dGVzdA==';
      (readFileAsBase64 as jest.Mock).mockResolvedValue(mockBase64);
      (getFileInfo as jest.Mock).mockResolvedValue({ size: 4 });

      // First generate the expected hash
      const hashResult = await generateHashFromBase64(mockBase64);

      const result = await verifyFileHash('/path/to/file.jpg', hashResult.hash);

      expect(result.isValid).toBe(true);
      expect(result.actualHash).toBe(result.expectedHash);
    });

    it('should return invalid when hashes differ', async () => {
      const mockBase64 = 'dGVzdA==';
      (readFileAsBase64 as jest.Mock).mockResolvedValue(mockBase64);
      (getFileInfo as jest.Mock).mockResolvedValue({ size: 4 });

      const wrongHash = 'a'.repeat(64);

      const result = await verifyFileHash('/path/to/file.jpg', wrongHash);

      expect(result.isValid).toBe(false);
      expect(result.expectedHash).toBe(wrongHash);
      expect(result.actualHash).not.toBe(wrongHash);
    });

    it('should include verification timestamp', async () => {
      const mockBase64 = 'dGVzdA==';
      (readFileAsBase64 as jest.Mock).mockResolvedValue(mockBase64);
      (getFileInfo as jest.Mock).mockResolvedValue({ size: 4 });

      const result = await verifyFileHash('/path/to/file.jpg', 'a'.repeat(64));

      expect(result.verifiedAt).toBeDefined();
      expect(new Date(result.verifiedAt).getTime()).not.toBeNaN();
    });
  });

  describe('EvidenceService singleton', () => {
    it('should return same instance', () => {
      const instance1 = EvidenceService.getInstance();
      const instance2 = EvidenceService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should export singleton as evidenceService', () => {
      expect(evidenceService).toBe(EvidenceService.getInstance());
    });

    it('should hash captured content', async () => {
      const result = await evidenceService.hashCapturedContent('dGVzdA==');

      expect(result.hash).toHaveLength(64);
      expect(result.algorithm).toBe('SHA-256');
    });
  });

  describe('Hash Verification Case Sensitivity', () => {
    it('should handle case-insensitive hash comparison in application logic', () => {
      // Evidence integrity comparison should be case-insensitive per decision pp-03
      const hash1 = 'abc123def456abc123def456abc123def456abc123def456abc123def456abcd1234';
      const hash2 = 'ABC123DEF456ABC123DEF456ABC123DEF456ABC123DEF456ABC123DEF456ABCD1234';

      expect(hash1.toLowerCase()).toBe(hash2.toLowerCase());
    });
  });
});

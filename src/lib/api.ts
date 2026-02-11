/**
 * API Client
 * HTTP client for backend communication with Clerk auth integration
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from "axios";
import { getToken as getAuthToken } from "./auth/storage";
import { isTokenExpired, getTokenRemainingSeconds } from "./auth/offline-verify";
import { refreshToken } from "./auth/api";
import { saveToken } from "./auth/storage";
import { config, envLog, envWarn } from "../config/environment";
import type { ApiResponse, BootstrapResponse, Report, ReportSummary } from "../types/shared";

// API Configuration - uses centralized environment config
const API_TIMEOUT = 30000; // 30 seconds
const TOKEN_REFRESH_THRESHOLD_SECONDS = 30 * 60; // Attempt refresh when <30 min remaining

// Create axios instance with environment-aware base URL
const apiClient: AxiosInstance = axios.create({
  baseURL: config.apiUrl,
  timeout: API_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
});

// Log API configuration on initialization (only in development/preview)
envLog(`API client initialized with baseURL: ${config.apiUrl}`);

// ============================================
// 401 UNAUTHORIZED CALLBACK
// ============================================

/**
 * Callback invoked when a 401 response is received.
 * Set by the app initialization to trigger auth store logout.
 * Uses a callback to avoid circular dependency with auth-store.
 */
let _onUnauthorized: (() => void) | null = null;
let _handling401 = false;

export function setOnUnauthorized(callback: () => void): void {
  _onUnauthorized = callback;
}

// ============================================
// TOKEN REFRESH LOGIC
// ============================================

let _isRefreshing = false;
let _refreshPromise: Promise<string | null> | null = null;

/**
 * Attempt to refresh token if it's close to expiry.
 * Deduplicates concurrent refresh attempts.
 */
async function maybeRefreshToken(token: string): Promise<string> {
  const remaining = getTokenRemainingSeconds(token);

  // Token still has plenty of time — use as-is
  if (remaining > TOKEN_REFRESH_THRESHOLD_SECONDS) {
    return token;
  }

  // Token expired — can't refresh
  if (remaining <= 0) {
    return token;
  }

  // Deduplicate concurrent refresh attempts
  if (_isRefreshing && _refreshPromise) {
    const refreshed = await _refreshPromise;
    return refreshed || token;
  }

  _isRefreshing = true;
  _refreshPromise = refreshToken(token);

  try {
    const newToken = await _refreshPromise;
    if (newToken) {
      await saveToken(newToken);
      envLog("[API] Token refreshed successfully");
      return newToken;
    }
    // Refresh failed (endpoint may not exist yet) — continue with current token
    return token;
  } catch {
    // Refresh failed — continue with current token until it truly expires
    return token;
  } finally {
    _isRefreshing = false;
    _refreshPromise = null;
  }
}

// ============================================
// INTERCEPTORS
// ============================================

// Request interceptor: add auth token + attempt refresh if near expiry
apiClient.interceptors.request.use(
  async (config) => {
    let token = await getAuthToken();
    if (token) {
      // Check if token is already expired before making request
      if (isTokenExpired(token)) {
        envWarn("[API] Token expired before request — triggering logout");
        if (_onUnauthorized && !_handling401) {
          _handling401 = true;
          _onUnauthorized();
          // Reset after short delay to allow re-login
          setTimeout(() => { _handling401 = false; }, 5000);
        }
        return Promise.reject(new axios.Cancel("Token expired"));
      }

      // Attempt proactive refresh if nearing expiry
      token = await maybeRefreshToken(token);
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: handle 401 by triggering logout
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && !_handling401) {
      envWarn("[API] 401 Unauthorized — clearing auth state");
      _handling401 = true;
      if (_onUnauthorized) {
        _onUnauthorized();
      }
      // Reset after short delay to allow re-login
      setTimeout(() => { _handling401 = false; }, 5000);
    }
    return Promise.reject(error);
  }
);

// ============================================
// API TYPES
// ============================================

export interface ApiError {
  message: string;
  code: string;
  status: number;
}

function handleApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ error?: string; message?: string }>;
    return {
      message: axiosError.response?.data?.error || axiosError.response?.data?.message || axiosError.message,
      code: axiosError.code || "UNKNOWN",
      status: axiosError.response?.status || 0,
    };
  }
  return {
    message: error instanceof Error ? error.message : "Unknown error",
    code: "UNKNOWN",
    status: 0,
  };
}

// ============================================
// SYNC ENDPOINTS
// ============================================

/**
 * Bootstrap endpoint - downloads all necessary data for app initialization
 */
export async function fetchBootstrapData(lastSyncAt?: string): Promise<ApiResponse<BootstrapResponse>> {
  try {
    const params = lastSyncAt ? { lastSyncAt } : {};
    envLog(`Calling bootstrap: ${config.apiUrl}/api/sync/bootstrap`, params);
    const response = await apiClient.get<ApiResponse<BootstrapResponse>>("/api/sync/bootstrap", { params });
    const data = response.data;
    envLog(`Bootstrap response: success=${data.success}, reports=${data.data?.recentReports?.length ?? 'N/A'}, user=${data.data?.user?.email ?? 'N/A'}`);
    return data;
  } catch (error) {
    const apiError = handleApiError(error);
    envWarn(`Bootstrap failed: ${apiError.status} ${apiError.code} - ${apiError.message}`);
    return {
      success: false,
      error: `${apiError.status} ${apiError.code}: ${apiError.message}`,
    };
  }
}

// ============================================
// REPORT ENDPOINTS
// ============================================

/**
 * Create a new report
 */
export async function createReport(data: Partial<Report>): Promise<ApiResponse<Report>> {
  try {
    const response = await apiClient.post<ApiResponse<Report>>("/api/reports", data);
    return response.data;
  } catch (error) {
    const apiError = handleApiError(error);
    return {
      success: false,
      error: apiError.message,
    };
  }
}

/**
 * Update an existing report
 */
export async function updateReport(id: string, data: Partial<Report>): Promise<ApiResponse<Report>> {
  try {
    const response = await apiClient.patch<ApiResponse<Report>>(`/api/reports/${id}`, data);
    return response.data;
  } catch (error) {
    const apiError = handleApiError(error);
    return {
      success: false,
      error: apiError.message,
    };
  }
}

/**
 * Get a report by ID
 */
export async function getReport(id: string): Promise<ApiResponse<Report>> {
  try {
    const response = await apiClient.get<ApiResponse<Report>>(`/api/reports/${id}`);
    return response.data;
  } catch (error) {
    const apiError = handleApiError(error);
    return {
      success: false,
      error: apiError.message,
    };
  }
}

/**
 * Get all reports for current user
 */
export async function getReports(): Promise<ApiResponse<ReportSummary[]>> {
  try {
    const response = await apiClient.get<ApiResponse<ReportSummary[]>>("/api/reports");
    return response.data;
  } catch (error) {
    const apiError = handleApiError(error);
    return {
      success: false,
      error: apiError.message,
    };
  }
}

// ============================================
// PHOTO ENDPOINTS
// ============================================

/**
 * Upload a photo
 */
export async function uploadPhoto(
  reportId: string,
  photoFile: Blob,
  metadata: {
    photoType: string;
    defectId?: string;
    roofElementId?: string;
    caption?: string;
    capturedAt?: string;
    gpsLat?: number;
    gpsLng?: number;
    cameraMake?: string;
    cameraModel?: string;
    originalHash: string;
  }
): Promise<ApiResponse<{ id: string; url: string }>> {
  try {
    const formData = new FormData();
    formData.append("photo", photoFile);
    formData.append("reportId", reportId);
    formData.append("metadata", JSON.stringify(metadata));

    const response = await apiClient.post<ApiResponse<{ id: string; url: string }>>("/api/photos", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 60000, // 60 seconds for photo upload
    });

    return response.data;
  } catch (error) {
    const apiError = handleApiError(error);
    return {
      success: false,
      error: apiError.message,
    };
  }
}

// ============================================
// DEFECT ENDPOINTS
// ============================================

/**
 * Create a defect
 */
export async function createDefect(
  reportId: string,
  data: {
    title: string;
    description: string;
    location: string;
    classification: string;
    severity: string;
    observation: string;
    analysis?: string;
    opinion?: string;
    recommendation?: string;
    roofElementId?: string;
  }
): Promise<ApiResponse<{ id: string }>> {
  try {
    const response = await apiClient.post<ApiResponse<{ id: string }>>("/api/defects", {
      reportId,
      ...data,
    });
    return response.data;
  } catch (error) {
    const apiError = handleApiError(error);
    return {
      success: false,
      error: apiError.message,
    };
  }
}

// ============================================
// COMPLIANCE ENDPOINTS
// ============================================

/**
 * Get compliance checklists
 */
export async function getChecklists(): Promise<ApiResponse<{ checklists: unknown[] }>> {
  try {
    const response = await apiClient.get<ApiResponse<{ checklists: unknown[] }>>("/api/compliance");
    return response.data;
  } catch (error) {
    const apiError = handleApiError(error);
    return {
      success: false,
      error: apiError.message,
    };
  }
}

/**
 * Save compliance assessment
 */
export async function saveComplianceAssessment(
  reportId: string,
  data: {
    checklistResults: Record<string, Record<string, string>>;
    nonComplianceSummary?: string;
  }
): Promise<ApiResponse<{ id: string }>> {
  try {
    const response = await apiClient.post<ApiResponse<{ id: string }>>(`/api/compliance/${reportId}`, data);
    return response.data;
  } catch (error) {
    const apiError = handleApiError(error);
    return {
      success: false,
      error: apiError.message,
    };
  }
}

// ============================================
// HEALTH CHECK
// ============================================

/**
 * Check if API is reachable
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    envLog(`Health check: ${config.apiUrl}/api/health`);
    const response = await apiClient.get("/api/health", { timeout: 5000 });
    envLog(`Health check result: ${response.status}`);
    return response.status === 200;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    envWarn(`Health check failed: ${msg}`);
    return false;
  }
}

// ============================================
// RETRY LOGIC
// ============================================

/**
 * Retry a request with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        envLog(`Retry attempt ${attempt + 1} after ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// Export the raw client for advanced use cases
export { apiClient, apiClient as api };

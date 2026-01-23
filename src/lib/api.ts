/**
 * API Client
 * HTTP client for backend communication with Clerk auth integration
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from "axios";
import { getAuthToken } from "./storage";
import type { ApiResponse, BootstrapResponse, Report, ReportSummary } from "../types/shared";

// API Configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
const API_TIMEOUT = 30000; // 30 seconds

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - trigger re-auth
      console.log("[API] Unauthorized - token may be expired");
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
    const response = await apiClient.get<ApiResponse<BootstrapResponse>>("/api/sync/bootstrap", { params });
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
    const response = await apiClient.get("/api/health", { timeout: 5000 });
    return response.status === 200;
  } catch {
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
        console.log(`[API] Retry attempt ${attempt + 1} after ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// Export the raw client for advanced use cases
export { apiClient };

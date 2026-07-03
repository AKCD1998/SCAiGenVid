const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

let currentCsrfToken = "";

export class ApiError extends Error {
  constructor(message, status, payload = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export function setCsrfToken(token) {
  currentCsrfToken = token || "";
}

function buildApiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${apiBaseUrl}${path}`;
}

async function parsePayload(response) {
  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text ? { message: text } : null;
}

/**
 * Low-level fetch wrapper: sets credentials:"include" so the httpOnly
 * session cookie is sent, attaches X-CSRF-Token on mutating requests when a
 * token has been set via setCsrfToken(), and defaults JSON content-type for
 * plain object bodies (skipped for FormData so the browser sets the correct
 * multipart boundary).
 */
export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const method = String(options.method || "GET").toUpperCase();

  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (currentCsrfToken && !["GET", "HEAD", "OPTIONS"].includes(method) && !headers.has("X-CSRF-Token")) {
    headers.set("X-CSRF-Token", currentCsrfToken);
  }

  return fetch(buildApiUrl(path), {
    credentials: "include",
    ...options,
    headers,
  });
}

async function requestJson(path, options = {}) {
  const response = await apiFetch(path, options);
  const payload = await parsePayload(response);

  if (!response.ok) {
    throw new ApiError(payload?.error || payload?.message || `HTTP ${response.status}`, response.status, payload);
  }

  return payload;
}

export const api = {
  // Auth endpoints are mounted at /admin/auth and /admin/me on the shared
  // admin-api backend (confirmed against apps/admin-api/src/server.js) — NOT
  // /api/auth. This app reuses that existing session/cookie system as-is.
  login({ username, password }) {
    return requestJson("/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: String(username || "").trim(),
        password: String(password || ""),
      }),
    });
  },

  async logout() {
    const response = await apiFetch("/admin/auth/logout", { method: "POST" });

    if (!response.ok && response.status !== 401) {
      const payload = await parsePayload(response);
      throw new ApiError(payload?.error || payload?.message || `HTTP ${response.status}`, response.status, payload);
    }
  },

  // Session restore on page load/refresh — relies on the httpOnly cookie
  // already being present; returns 401 if there is no valid session.
  getMe() {
    return requestJson("/admin/me");
  },

  getVideoJobConfig() {
    return requestJson("/api/content/video-jobs/config");
  },

  getUsageSummary() {
    return requestJson("/api/content/usage-summary");
  },

  createVideoJob(body) {
    return requestJson("/api/content/video-jobs", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  listVideoJobs(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        query.set(key, String(value));
      }
    });
    const qs = query.toString();
    return requestJson(`/api/content/video-jobs${qs ? `?${qs}` : ""}`);
  },

  getVideoJob(jobId) {
    return requestJson(`/api/content/video-jobs/${encodeURIComponent(jobId)}`);
  },

  submitVideoJob(jobId) {
    return requestJson(`/api/content/video-jobs/${encodeURIComponent(jobId)}/submit`, {
      method: "POST",
    });
  },

  retryVideoJob(jobId) {
    return requestJson(`/api/content/video-jobs/${encodeURIComponent(jobId)}/retry`, {
      method: "POST",
    });
  },

  cancelVideoJob(jobId) {
    return requestJson(`/api/content/video-jobs/${encodeURIComponent(jobId)}/cancel`, {
      method: "POST",
    });
  },

  approveVideoJob(jobId, note) {
    return requestJson(`/api/content/video-jobs/${encodeURIComponent(jobId)}/approve`, {
      method: "POST",
      body: JSON.stringify(note ? { note } : {}),
    });
  },

  rejectVideoJob(jobId, reason) {
    return requestJson(`/api/content/video-jobs/${encodeURIComponent(jobId)}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  getVideoJobEvents(jobId) {
    return requestJson(`/api/content/video-jobs/${encodeURIComponent(jobId)}/events`);
  },

  getVideoJobDownloadUrl(jobId) {
    return requestJson(`/api/content/video-jobs/${encodeURIComponent(jobId)}/download`);
  },

  initAssetUpload({ mimeType, assetType = "input_image", originalFilename }) {
    return requestJson("/api/content/assets/upload-init", {
      method: "POST",
      body: JSON.stringify({ mimeType, assetType, originalFilename }),
    });
  },

  async completeAssetUpload({ assetId, file }) {
    const formData = new FormData();
    formData.append("assetId", assetId);
    formData.append("file", file);

    const response = await apiFetch("/api/content/assets/upload-complete", {
      method: "POST",
      body: formData,
    });
    const payload = await parsePayload(response);

    if (!response.ok) {
      throw new ApiError(payload?.error || payload?.message || `HTTP ${response.status}`, response.status, payload);
    }

    return payload;
  },
};

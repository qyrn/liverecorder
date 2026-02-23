const BASE = "/api";

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  health: () => request("GET", "/health"),

  streamers: {
    list: () => request("GET", "/streamers"),
    create: (data) => request("POST", "/streamers", data),
    update: (id, data) => request("PATCH", `/streamers/${id}`, data),
    remove: (id) => request("DELETE", `/streamers/${id}`),
  },

  recordings: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request("GET", `/recordings${qs ? `?${qs}` : ""}`);
    },
    active: () => request("GET", "/recordings/active"),
    start: (data) => request("POST", "/recordings/start", data),
    cancel: (id) => request("POST", `/recordings/${id}/cancel`),
  },

  settings: {
    get: () => request("GET", "/settings"),
    update: (data) => request("PATCH", "/settings", data),
  },
};

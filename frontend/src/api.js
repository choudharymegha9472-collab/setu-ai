const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function req(path, options) {
  const res = await fetch(`${BASE}/api${path}`, options);
  let body = null;
  try { body = await res.json(); } catch { /* no json body */ }
  if (!res.ok) throw new Error(body?.error || res.statusText || "Request failed");
  return body;
}

const json = (method, data) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

export const api = {
  summary: () => req("/summary"),
  sensors: () => req("/sensors"),
  readings: (id, limit = 300) => req(`/readings/${encodeURIComponent(id)}?limit=${limit}`),
  alerts: (status) => req(`/alerts${status ? `?status=${status}` : ""}`),
  setAlertStatus: (id, status) => req(`/alerts/${id}`, json("PATCH", { status })),
  simulate: () => req("/simulate?sensors=3&points=300", { method: "POST" }),
  reset: () => req("/reset", { method: "DELETE" }),
  uploadCsv: async (file) =>
    req("/upload-csv", { method: "POST", headers: { "Content-Type": "text/csv" }, body: await file.text() }),
};

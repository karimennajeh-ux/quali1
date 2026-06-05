const configuredApiUrl = String(
  window.VITE_API_URL ||
  window.QUALI_API_URL ||
  localStorage.getItem("VITE_API_URL") ||
  localStorage.getItem("QUALI_API_URL") ||
  ""
).trim();

export const API_URL = configuredApiUrl.replace(/\/+$/, "");

export function apiUrl(path) {
  const base = API_URL || `${location.origin}${location.pathname.replace(/\/[^/]*$/, "")}`.replace(/\/+$/, "");
  return new URL(String(path || "").replace(/^\/+/, ""), `${base}/`).href;
}

export async function apiRequest(path, options = {}) {
  const cfg = { method: "GET", headers: { Accept: "application/json" }, ...options };
  if (cfg.body !== undefined && cfg.body !== null && typeof cfg.body !== "string") {
    cfg.headers = { "Content-Type": "application/json", ...(cfg.headers || {}) };
    cfg.body = JSON.stringify(cfg.body);
  }
  let response;
  let data = null;
  try {
    response = await fetch(apiUrl(path), cfg);
    data = await response.json().catch(() => null);
  } catch (error) {
    throw new Error("Erreur de connexion au serveur local");
  }
  if (!response.ok || !data || data.success === false) {
    throw new Error((data && data.message) || "Erreur de connexion au serveur local");
  }
  return data;
}

/**
 * HTTP client for Sanad AI API — handles auth + JSON requests.
 */

const API_URL = process.env.SANAD_API_URL || "http://100.109.59.30:3100";
const EMAIL = process.env.SANAD_EMAIL || "";
const PASSWORD = process.env.SANAD_PASSWORD || "";
export const COMPANY_ID = process.env.SANAD_COMPANY_ID || "";

let sessionCookie = "";

async function login() {
  if (sessionCookie) return;
  const res = await fetch(`${API_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: API_URL },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) {
    if (c.includes("session_token")) {
      sessionCookie = c.split(";")[0];
      break;
    }
  }
  if (!sessionCookie) {
    const text = await res.text();
    throw new Error(`Login failed: ${res.status} ${text.slice(0, 200)}`);
  }
}

export async function api(path, opts = {}) {
  await login();
  let res = await fetch(`${API_URL}/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Origin: API_URL,
      Cookie: sessionCookie,
      ...(opts.headers || {}),
    },
  });
  // Re-auth on 401 (expired session) and retry once
  if (res.status === 401) {
    sessionCookie = "";
    await login();
    res = await fetch(`${API_URL}/api${path}`, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        Origin: API_URL,
        Cookie: sessionCookie,
        ...(opts.headers || {}),
      },
    });
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${opts.method || "GET"} ${path}: ${res.status} ${text.slice(0, 300)}`);
  }
  return res.json();
}

export { API_URL };

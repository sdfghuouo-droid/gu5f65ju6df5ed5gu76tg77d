const API_BASE = import.meta.env.BASE_URL ? `${import.meta.env.BASE_URL}api` : 'api';

export interface MeResponse {
  username: string;
}

export async function getMe(): Promise<MeResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'same-origin' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function login(username: string, password: string): Promise<MeResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error('Invalid credentials');
  }
  return await res.json();
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'same-origin' });
  } catch {
    // ignore
  }
}
const STORAGE_KEY = 'api_base_url';

/** Returns the active backend URL. Priority: localStorage → VITE_API_BASE_URL → default */
export function getBaseUrl(): string {
  return (
    localStorage.getItem(STORAGE_KEY) ||
    import.meta.env.VITE_API_BASE_URL ||
    'http://localhost:9090'
  );
}

/** Saves a custom backend URL to localStorage (strips trailing slash). */
export function setBaseUrl(url: string): void {
  localStorage.setItem(STORAGE_KEY, url.trim().replace(/\/$/, ''));
}

/** Removes any custom backend URL, reverting to the env/default fallback. */
export function clearBaseUrl(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = sessionStorage.getItem('token');

  const isFormData = options.body instanceof FormData;

  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  } as Record<string, string>;

  const response = await fetch(`${getBaseUrl()}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      window.location.href = '/signin';
    }
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || response.statusText);
  }

  return response.json();
}

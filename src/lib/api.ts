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

/** True for iPhone HEIC/HEIF photos (by MIME type or extension). */
function isHeic(file: File): boolean {
  return /^image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

/** Converts HEIC/HEIF files in an upload FormData to JPEG in the browser; other entries are untouched. */
async function convertHeicInFormData(form: FormData): Promise<FormData> {
  const out = new FormData();
  for (const [key, value] of Array.from(form.entries())) {
    if (value instanceof File && isHeic(value)) {
      try {
        const { default: heic2any } = await import('heic2any');
        const result = await heic2any({ blob: value, toType: 'image/jpeg', quality: 0.9 });
        const blob = Array.isArray(result) ? result[0] : result;
        out.append(key, blob, value.name.replace(/\.hei[cf]$/i, '') + '.jpg');
        continue;
      } catch {
        // Conversion failed: fall through and upload the original file.
      }
    }
    out.append(key, value);
  }
  return out;
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (endpoint === '/api/upload' && options.body instanceof FormData) {
    options = { ...options, body: await convertHeicInFormData(options.body) };
  }

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
    const err = new Error(error.message || response.statusText) as Error & { status?: number; title?: string };
    err.status = response.status;
    err.title = error.title;
    throw err;
  }

  return response.json();
}

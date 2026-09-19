import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiFetch, getBaseUrl, setBaseUrl, clearBaseUrl } from './api';

describe('getBaseUrl / setBaseUrl / clearBaseUrl', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to localhost:9090 when nothing is configured', () => {
    expect(getBaseUrl()).toBe('http://localhost:9090');
  });

  it('prefers a base URL saved to localStorage', () => {
    setBaseUrl('https://example.com');
    expect(getBaseUrl()).toBe('https://example.com');
  });

  it('trims whitespace and a trailing slash when saving', () => {
    setBaseUrl('  https://example.com/  ');
    expect(localStorage.getItem('api_base_url')).toBe('https://example.com');
  });

  it('reverts to the default once cleared', () => {
    setBaseUrl('https://example.com');
    clearBaseUrl();
    expect(getBaseUrl()).toBe('http://localhost:9090');
  });
});

describe('apiFetch', () => {
  const originalFetch = global.fetch;
  const originalLocation = window.location;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
    vi.restoreAllMocks();
  });

  it('attaches a bearer token and JSON content-type, and returns the parsed body', async () => {
    sessionStorage.setItem('token', 'abc123');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ hello: 'world' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await apiFetch<{ hello: string }>('/api/things', { method: 'POST', body: '{}' });

    expect(result).toEqual({ hello: 'world' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:9090/api/things');
    expect(init.headers.Authorization).toBe('Bearer abc123');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('omits the Content-Type header for FormData bodies', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    global.fetch = fetchMock as unknown as typeof fetch;

    await apiFetch('/api/upload', { method: 'POST', body: new FormData() });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['Content-Type']).toBeUndefined();
  });

  it('on a 401, clears the session and redirects to /signin', async () => {
    sessionStorage.setItem('token', 'stale-token');
    sessionStorage.setItem('user', '{"id":1}');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ message: 'Session expired' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const locationStub = { href: '' };
    Object.defineProperty(window, 'location', { value: locationStub, writable: true });

    await expect(apiFetch('/api/protected')).rejects.toThrow('Session expired');

    expect(sessionStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('user')).toBeNull();
    expect(locationStub.href).toBe('/signin');
  });

  it('throws an error carrying the status and title when a non-401 request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({ message: 'Boom', title: 'Internal Error' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    try {
      await apiFetch('/api/things');
      expect.unreachable('apiFetch should have thrown');
    } catch (err: any) {
      expect(err.message).toBe('Boom');
      expect(err.status).toBe(500);
      expect(err.title).toBe('Internal Error');
    }
  });
});

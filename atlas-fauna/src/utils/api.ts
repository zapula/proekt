const DEFAULT_API_URL = 'http://localhost:3001';

export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, '');

export const apiUrl = (path: string) => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

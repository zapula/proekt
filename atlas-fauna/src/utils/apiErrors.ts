export const ADMIN_SESSION_EXPIRED_MESSAGE = 'Сессия администратора истекла. Войдите заново.';

export class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

const getMessageFromPayload = (payload: unknown) => {
  if (!payload) return null;

  if (typeof payload === 'string') {
    const text = payload.trim();
    return text || null;
  }

  if (typeof payload === 'object' && 'error' in payload) {
    const errorMessage = (payload as { error?: unknown }).error;
    if (typeof errorMessage === 'string' && errorMessage.trim()) {
      return errorMessage.trim();
    }
  }

  return null;
};

export const readApiErrorMessage = async (response: Response) => {
  const contentType = response.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      const json = await response.clone().json();
      const jsonMessage = getMessageFromPayload(json);
      if (jsonMessage) {
        return jsonMessage;
      }
    }

    const text = await response.clone().text();
    const textMessage = getMessageFromPayload(text);
    if (textMessage) {
      return textMessage;
    }
  } catch {
    return null;
  }

  return null;
};

export const createApiRequestError = async (response: Response, fallbackMessage: string) => {
  const message = (await readApiErrorMessage(response)) || fallbackMessage;
  return new ApiRequestError(response.status, message);
};

export const getApiRequestErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
};

export const isAdminSessionExpiredError = (error: unknown) => {
  if (!(error instanceof ApiRequestError)) {
    return false;
  }

  if (error.status === 401) {
    return true;
  }

  if (error.status !== 403) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('токен') ||
    message.includes('просроч') ||
    message.includes('невалид') ||
    message.includes('авторизац')
  );
};

export interface FieldIssue {
  path: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly issues: FieldIssue[];

  constructor(status: number, message: string, issues: FieldIssue[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.issues = issues;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

interface ErrorBody {
  error?: unknown;
  details?: unknown;
}

function parseIssues(details: unknown): FieldIssue[] {
  if (!Array.isArray(details)) return [];
  return details.flatMap((d) => {
    if (typeof d !== 'object' || d === null) return [];
    const { path, message } = d as { path?: unknown; message?: unknown };
    if (typeof message !== 'string') return [];
    const joined = Array.isArray(path) ? path.join('.') : '';
    return [{ path: joined, message }];
  });
}

/** Builds an ApiError from a failed fetch Response (body read defensively). */
export async function toApiError(response: Response): Promise<ApiError> {
  let body: ErrorBody = {};
  try {
    body = (await response.clone().json()) as ErrorBody;
  } catch {
    // non-JSON body; fall through to defaults
  }
  const message =
    response.status === 429
      ? 'Too many requests. Please wait a moment and try again.'
      : typeof body.error === 'string'
        ? body.error
        : `Request failed (${response.status})`;
  return new ApiError(response.status, message, parseIssues(body.details));
}

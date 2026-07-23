/** API 错误码：与 OpenAPI 契约保持一致。 */
export type ApiErrorCode =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_STATE'
  | 'VALIDATION'
  | 'FORBIDDEN'
  | 'INTERNAL';

/** 统一 API 错误。状态机与 UI 据此区分分支（如“未仿真即审批”返回 INVALID_STATE）。 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, message: string, status = 400) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
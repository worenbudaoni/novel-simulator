export interface AuthResponse {
  sessionId: string;
  userId: number;
  username: string;
  nickname: string;
  roles: string[];
  permissions: string[];
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  nickname?: string;
}

export interface ApiResult<T> {
  code: number;
  message: string;
  data: T;
}

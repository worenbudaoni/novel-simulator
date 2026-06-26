export interface ApiResult<T> {
  code: number;
  message: string;
  data: T;
}

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

export interface ChoiceOption {
  id?: number;
  label: string;
  targetNodeId: number;
  riskLevel: 'safe' | 'risky' | 'daring';
  attrHint?: string;
  expectedOutcome?: string;
}

export interface ResolutionResult {
  actionType: string;
  targetNodeId: number;
  riskLevel: string;
  checkAttr?: string;
  attrValue?: number;
  diceRoll?: number;
  dc?: number;
  modifier?: number;
  total?: number;
  success: boolean;
  attrChanges: Record<string, number>;
  isDead: boolean;
  eventTitle?: string;
  eventContent?: string;
  sector?: number;           // 0=奇遇 1=宝箱 2=战斗 3=诅咒 4=命运 5=邂逅
}

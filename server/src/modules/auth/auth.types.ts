export interface RegisterRequestBody {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequestBody {
  email: string;
  password: string;
}

export interface JwtUserPayload {
  id: string;
  email: string;
}

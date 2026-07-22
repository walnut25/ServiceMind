import type { UserRole } from "@/types/domain";

export interface UserResponse {
  id: number;
  username: string;
  enabled: boolean;
  roles: UserRole[];
  createdAt: string;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  roles: UserRole[];
}

export interface ChangeEnabledRequest {
  enabled: boolean;
}

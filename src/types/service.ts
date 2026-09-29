export interface PaginatedResult<T> {
  items: T[];
  totalItems: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string>;
}

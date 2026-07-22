export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
}

export interface PageResponse<T> {
  content: T[];
  page: {
    size: number;
    number: number;
    totalElements: number;
    totalPages: number;
  };
}

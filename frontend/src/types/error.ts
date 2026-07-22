import type { AxiosError } from "axios";
import type { ProblemDetail } from "./api";

export type ApiError = AxiosError<ProblemDetail>;

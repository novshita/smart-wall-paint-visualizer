/** Standard error shape returned by the API (spec §10). */
export interface ApiError {
  status: number;
  message: string;
  errors: { field?: string; message: string }[];
}

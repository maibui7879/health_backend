export class ApiResponseDto<T = any> {
  success!: boolean;
  statusCode!: number;
  message!: string;
  data!: T | null;
  errors?: any;
}

import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token dùng để gọi các API yêu cầu xác thực',
  })
  access_token!: string;

  @ApiProperty({
    example: '8b7c2e4a-1f5d-4a0b-9c3d-2e6f7a8b9c0d',
    description: 'ID của người dùng vừa xác thực',
  })
  user_id!: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Refresh token dùng để cấp access token mới',
  })
  refresh_token!: string;
}
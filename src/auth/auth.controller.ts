import { Body, Controller, Post, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterRequestOtpDto } from './dto/register-request-otp.dto';
import { RegisterVerifyOtpDto } from './dto/register-verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenPayload } from './strategies/refresh-token.strategy';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Đăng ký trực tiếp (giữ tương thích FE cũ)' })
  @ApiResponse({
    status: 201,
    description: 'Đăng ký thành công và trả về access token.',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu đăng ký không hợp lệ.' })
  @ApiResponse({ status: 409, description: 'Email đã được sử dụng.' })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('register/request-otp')
  @ApiOperation({ summary: 'Bước 1 đăng ký 2 bước: gửi OTP về email' })
  @ApiResponse({
    status: 201,
    description: 'Đã gửi OTP (nếu email chưa dùng).',
  })
  @ApiResponse({ status: 409, description: 'Email đã được sử dụng.' })
  @ApiResponse({ status: 429, description: 'Yêu cầu mã quá nhiều.' })
  registerRequestOtp(@Body() dto: RegisterRequestOtpDto) {
    return this.authService.registerRequestOtp(dto);
  }

  @Post('register/verify-otp')
  @ApiOperation({
    summary: 'Bước 2 đăng ký 2 bước: xác thực OTP và tạo tài khoản',
  })
  @ApiResponse({
    status: 201,
    description: 'Tạo tài khoản thành công, trả về access token.',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: 'OTP sai / hết hạn.' })
  registerVerifyOtp(@Body() dto: RegisterVerifyOtpDto) {
    return this.authService.registerVerifyOtp(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Đăng nhập' })
  @ApiResponse({
    status: 201,
    description: 'Đăng nhập thành công và trả về access token.',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu đăng nhập không hợp lệ.' })
  @ApiResponse({ status: 401, description: 'Email hoặc mật khẩu không đúng.' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @UseGuards(AuthGuard('jwt-refresh'))
  @ApiOperation({ summary: 'Cấp access token mới từ refresh token' })
  @ApiResponse({
    status: 201,
    description: 'Cấp token mới thành công.',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Refresh token không hợp lệ hoặc đã hết hạn.',
  })
  refresh(@Request() request: { user: RefreshTokenPayload }) {
    return this.authService.refresh(request.user);
  }

  @Post('google/login')
  @ApiOperation({ summary: 'Đăng nhập bằng Google ID Token' })
  @ApiResponse({
    status: 201,
    description: 'Thành công',
    type: AuthResponseDto,
  })
  googleLogin(@Body() body: GoogleLoginDto) {
    return this.authService.verifyGoogleLogin(body.token);
  }

  @Post('change-password')
  @UseGuards(AuthGuard('jwt-access'))
  @ApiOperation({ summary: 'Đổi mật khẩu (đang đăng nhập)' })
  @ApiResponse({ status: 201, description: 'Đổi mật khẩu thành công.' })
  @ApiResponse({
    status: 400,
    description: 'Mật khẩu hiện tại sai / tài khoản Google.',
  })
  changePassword(
    @Request() request: { user: RefreshTokenPayload },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(request.user.sub, dto);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Gửi mã OTP đặt lại mật khẩu qua email' })
  @ApiResponse({
    status: 201,
    description: 'Luôn trả thành công để không lộ email đã đăng ký.',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Đặt lại mật khẩu bằng OTP' })
  @ApiResponse({ status: 201, description: 'Đặt lại mật khẩu thành công.' })
  @ApiResponse({ status: 400, description: 'OTP sai / hết hạn.' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}

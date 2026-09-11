import { Body, Controller, Post, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RefreshTokenPayload } from './strategies/refresh-token.strategy';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Post('register')
	@ApiOperation({ summary: 'Đăng ký tài khoản' })
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
	@ApiResponse({ status: 401, description: 'Refresh token không hợp lệ hoặc đã hết hạn.' })
	refresh(@Request() request: { user: RefreshTokenPayload }, @Body() _refreshTokenDto: RefreshTokenDto) {
		return this.authService.refresh(request.user);
	}
}

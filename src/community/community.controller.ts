import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CommunityService } from './community.service';
import {
  CreateCommentDto,
  CreatePostDto,
  FeedQueryDto,
  ReactDto,
  ReportPostDto,
  UpdateCommentDto,
  UpdatePostDto,
} from './dto/community.dto';

@ApiTags('Community')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-access'))
@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Get('posts')
  @ApiOperation({ summary: 'Feed cộng đồng (ẩn bài bị report nhiều)' })
  feed(@CurrentUser('sub') userId: string, @Query() query: FeedQueryDto) {
    return this.communityService.feed(userId, query);
  }

  @Get('posts/mine')
  @ApiOperation({ summary: 'Bài đăng của tôi (gồm cả bài bị ẩn)' })
  mine(@CurrentUser('sub') userId: string, @Query() query: FeedQueryDto) {
    return this.communityService.mine(userId, query);
  }

  @Get('posts/:id')
  @ApiOperation({ summary: 'Chi tiết 1 bài đăng' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy bài viết.' })
  getOne(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.communityService.getOne(userId, id);
  }

  @Post('posts')
  @ApiOperation({
    summary: 'Đăng bài (kèm link thực đơn / buổi tập / bữa ăn nếu muốn)',
  })
  @ApiBody({ type: CreatePostDto })
  @ApiResponse({ status: 201, description: 'Đăng bài thành công.' })
  create(@CurrentUser('sub') userId: string, @Body() dto: CreatePostDto) {
    return this.communityService.create(userId, dto);
  }

  @Patch('posts/:id')
  @ApiOperation({ summary: 'Sửa bài của mình (chỉ chủ bài)' })
  @ApiResponse({ status: 403, description: 'Không có quyền.' })
  update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.communityService.update(userId, id, dto);
  }

  @Delete('posts/:id')
  @ApiOperation({ summary: 'Xóa bài của mình (chỉ chủ bài)' })
  remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.communityService.remove(userId, id);
  }

  @Get('posts/:id/comments')
  @ApiOperation({ summary: 'Danh sách bình luận của bài' })
  comments(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Query() query: FeedQueryDto,
  ) {
    return this.communityService.listComments(userId, id, query);
  }

  @Post('posts/:id/comments')
  @ApiOperation({ summary: 'Bình luận vào bài' })
  @ApiBody({ type: CreateCommentDto })
  @ApiResponse({ status: 201, description: 'Bình luận thành công.' })
  comment(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.communityService.createComment(userId, id, dto);
  }

  @Patch('comments/:commentId')
  @ApiOperation({ summary: 'Sửa bình luận (chỉ chủ comment)' })
  updateComment(
    @CurrentUser('sub') userId: string,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.communityService.updateComment(userId, commentId, dto);
  }

  @Delete('comments/:commentId')
  @ApiOperation({ summary: 'Xóa bình luận (chủ comment hoặc chủ bài)' })
  removeComment(
    @CurrentUser('sub') userId: string,
    @Param('commentId') commentId: string,
  ) {
    return this.communityService.deleteComment(userId, commentId);
  }

  @Post('posts/:id/like')
  @ApiOperation({ summary: 'Thả tim bài viết' })
  like(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: ReactDto,
  ) {
    return this.communityService.like(userId, id, dto);
  }

  @Delete('posts/:id/like')
  @ApiOperation({ summary: 'Bỏ tim bài viết' })
  unlike(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.communityService.unlike(userId, id);
  }

  @Post('posts/:id/report')
  @ApiOperation({
    summary: 'Báo cáo bài viết (đủ 3 report → tự ẩn khỏi feed)',
  })
  @ApiResponse({ status: 409, description: 'Đã báo cáo bài này rồi.' })
  report(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: ReportPostDto,
  ) {
    return this.communityService.report(userId, id, dto);
  }
}

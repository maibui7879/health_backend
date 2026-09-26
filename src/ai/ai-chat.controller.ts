import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AiChatService, SSE_EVENT_ERROR_429 } from './ai-chat.service';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ChatResponseDto } from './dto/chat-response.dto';
import { ChatRetryDto } from './dto/chat-retry.dto';

@ApiTags('AI Chat')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-access'))
@Controller('ai')
export class AiChatController {
  constructor(private readonly chatService: AiChatService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chat với trợ lý AI (REST)' })
  @ApiBody({ type: ChatRequestDto })
  @ApiResponse({ status: 200, type: ChatResponseDto })
  chat(@CurrentUser('sub') userId: string, @Body() dto: ChatRequestDto) {
    return this.chatService.chat(userId, dto);
  }

  @Post('chat/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sinh lại câu trả lời khi gặp lỗi 429' })
  @ApiBody({ type: ChatRetryDto })
  retry(@CurrentUser('sub') userId: string, @Body() dto: ChatRetryDto) {
    return this.chatService.retry(userId, dto.conversation_id);
  }

  // POST SSE (không dùng GET để tránh lộ message trên URL và lỗi encode
  // tiếng Việt/emoji). Mobile dùng react-native-sse hoặc fetch+ReadableStream.
  // Event: {token} nhiều lần -> [DONE] | [ERROR_429]
  @Post('chat/stream')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chat streaming qua SSE (POST)' })
  @ApiBody({ type: ChatRequestDto })
  async stream(
    @CurrentUser('sub') userId: string,
    @Body() dto: ChatRequestDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const send = (data: string) => {
      if (!res.writableEnded) res.write(`data: ${data}\n\n`);
    };

    try {
      const result = await this.chatService.generateForStream(userId, dto);
      send(
        JSON.stringify({
          conversation_id: result.conversation_id,
          suggested_questions: result.suggested_questions,
        }),
      );
      // Bắn reply theo chunk để tạo hiệu ứng gõ chữ, tiết kiệm OTPM
      // (chỉ 1 lần gọi Groq, không stream token-by-token từ Groq).
      const text = result.reply;
      const CHUNK = 24;
      for (let i = 0; i < text.length; i += CHUNK) {
        if (res.writableEnded || res.destroyed) break;
        send(JSON.stringify({ token: text.slice(i, i + CHUNK) }));
        await new Promise((r) => setTimeout(r, 15));
      }
      send('[DONE]');
    } catch (e) {
      const status =
        (e as { status?: number })?.status ??
        (e as { getStatus?: () => number })?.getStatus?.();
      if (status === HttpStatus.TOO_MANY_REQUESTS) {
        send(SSE_EVENT_ERROR_429);
      } else {
        send(
          JSON.stringify({
            error: (e as Error)?.message ?? 'Không thể trả lời lúc này.',
          }),
        );
      }
    } finally {
      if (!res.writableEnded) res.end();
    }
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Danh sách hội thoại' })
  list(
    @CurrentUser('sub') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.chatService.listConversations(
      userId,
      limit ? Number(limit) : 20,
      offset ? Number(offset) : 0,
    );
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Lịch sử tin nhắn của hội thoại' })
  history(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.getHistory(userId, id, limit ? Number(limit) : 50);
  }

  @Delete('conversations/:id')
  @ApiOperation({ summary: 'Xóa hội thoại' })
  remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.chatService.deleteConversation(userId, id);
  }
}

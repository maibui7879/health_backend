import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import Groq from 'groq-sdk';
import { Repository } from 'typeorm';
import { NutritionService } from '../nutrition/nutrition.service';
import { DailyLog } from '../tracking/entities/daily-log.entity';
import { UsersService } from '../users/users.service';
import { Workout } from '../workout/entities/workout.entity';
import {
  buildSuggestedQuestions,
  buildSystemPrompt,
  buildChatTools,
  CHAT_HISTORY_LIMIT,
  CHAT_MAX_TOKENS,
  CHAT_MODEL_FALLBACK,
  type PreInjectedContext,
  truncateForPrompt,
} from './ai-chat.system';
import type { ChatRequestDto } from './dto/chat-request.dto';
import { AiConversation } from './entities/ai-conversation.entity';
import { AiMessage } from './entities/ai-message.entity';
import { LocalizationService } from '../i18n/localization.service';

type ChatMessageParam = Groq.Chat.ChatCompletionMessageParam;
type ChatToolCall = Groq.Chat.ChatCompletionMessageToolCall;

export const SSE_EVENT_ERROR_429 = '[ERROR_429]';

interface ToolTraceResult {
  id: string;
  name: string;
  content: string;
}

interface ToolTraceStep {
  assistantContent: string;
  toolCalls: ChatToolCall[];
  results: ToolTraceResult[];
}

interface ToolError {
  status?: number;
  statusCode?: number;
  code?: string;
  error?: { code?: string };
}

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);
  private groq: Groq;
  private readonly model: string;

  constructor(
    private configService: ConfigService,
    @InjectRepository(AiConversation)
    private convRepo: Repository<AiConversation>,
    @InjectRepository(AiMessage)
    private msgRepo: Repository<AiMessage>,
    @InjectRepository(DailyLog)
    private logRepo: Repository<DailyLog>,
    @InjectRepository(Workout)
    private workoutRepo: Repository<Workout>,
    private usersService: UsersService,
    private nutritionService: NutritionService,
    private readonly i18n: LocalizationService,
  ) {
    this.groq = new Groq({
      apiKey: this.configService.get<string>('GROQ_API_KEY'),
    });
    this.model =
      this.configService.get<string>('GROQ_MODEL') ?? CHAT_MODEL_FALLBACK;
  }

  // ---------- public API ----------

  async chat(userId: string, dto: ChatRequestDto) {
    const conv = await this.ensureConversation(userId, dto.conversation_id);
    if (!dto.conversation_id) {
      conv.title =
        dto.message.trim().slice(0, 40) || this.i18n.t('ai.newConversation');
      await this.convRepo.save(conv);
    }

    await this.saveMessage(
      userId,
      conv.id,
      'user',
      dto.message.trim(),
      null,
      null,
    );

    try {
      const { reply, tokensUsed, trace } = await this.generateReply(
        userId,
        conv.id,
        dto.message.trim(),
      );
      await this.persistTrace(userId, conv.id, trace);
      await this.saveMessage(
        userId,
        conv.id,
        'assistant',
        reply,
        null,
        tokensUsed,
      );
      await this.touchConversation(conv.id);

      const goalType = await this.getGoalType(userId);
      const lang = this.i18n.lang();
      return {
        conversation_id: conv.id,
        reply,
        suggested_questions: buildSuggestedQuestions(reply, goalType, lang),
        tokens_used: tokensUsed,
      };
    } catch (e) {
      if (this.isRateLimit(e)) {
        // Đã lưu user msg, chưa lưu AI msg — client hiện popup + nút Retry.
        throw new HttpException(
          {
            success: false,
            message: this.i18n.t('ai.overloaded'),
            data: { conversation_id: conv.id, retryable: true },
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw e;
    }
  }

  // Sinh lại câu trả lời từ lịch sử gần nhất, không cần user gõ lại.
  async retry(userId: string, conversationId: string) {
    const conv = await this.getOwnedConversation(userId, conversationId);
    const history = await this.loadHistory(conv.id, CHAT_HISTORY_LIMIT);
    const lastUser = [...history].reverse().find((m) => m.role === 'user');
    if (!lastUser) {
      throw new NotFoundException(this.i18n.t('ai.nothingToRetry'));
    }
    try {
      const { reply, tokensUsed, trace } = await this.generateReply(
        userId,
        conv.id,
        lastUser.content,
      );
      await this.persistTrace(userId, conv.id, trace);
      await this.saveMessage(
        userId,
        conv.id,
        'assistant',
        reply,
        null,
        tokensUsed,
      );
      await this.touchConversation(conv.id);
      const goalType = await this.getGoalType(userId);
      const retryLang = this.i18n.lang();
      return {
        conversation_id: conv.id,
        reply,
        suggested_questions: buildSuggestedQuestions(
          reply,
          goalType,
          retryLang,
        ),
        tokens_used: tokensUsed,
      };
    } catch (e) {
      if (this.isRateLimit(e)) {
        throw new HttpException(
          this.i18n.t('ai.overloadedRetry'),
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw e;
    }
  }

  // Dùng cho endpoint SSE: sinh full reply 1 lần (tối ưu OTPM),
  // controller bắn từng chunk qua res.write để tạo hiệu ứng gõ chữ.
  async generateForStream(userId: string, dto: ChatRequestDto) {
    return this.chat(userId, dto);
  }

  async listConversations(userId: string, limit = 20, offset = 0) {
    const take = Math.min(Math.max(limit, 1), 50);
    const [items, total] = await this.convRepo.findAndCount({
      where: { user_id: userId },
      order: { updated_at: 'DESC' },
      take,
      skip: Math.max(offset, 0),
    });
    return { items, total };
  }

  async getHistory(userId: string, conversationId: string, limit = 50) {
    await this.getOwnedConversation(userId, conversationId);
    const take = Math.min(Math.max(limit, 1), 100);
    const msgs = await this.msgRepo.find({
      where: { conversation_id: conversationId },
      order: { created_at: 'DESC' },
      take,
    });
    return [...msgs].reverse();
  }

  async deleteConversation(userId: string, conversationId: string) {
    const conv = await this.getOwnedConversation(userId, conversationId);
    await this.convRepo.remove(conv);
    return { message: this.i18n.t('ai.conversationDeleted') };
  }

  // ---------- internals ----------

  private async ensureConversation(userId: string, conversationId?: string) {
    if (!conversationId) {
      const conv = this.convRepo.create({ user_id: userId });
      return this.convRepo.save(conv);
    }
    return this.getOwnedConversation(userId, conversationId);
  }

  private async getOwnedConversation(userId: string, conversationId: string) {
    const conv = await this.convRepo.findOne({
      where: { id: conversationId },
    });
    if (!conv)
      throw new NotFoundException(this.i18n.t('ai.conversationNotFound'));
    if (conv.user_id !== userId) {
      throw new ForbiddenException(this.i18n.t('ai.conversationForbidden'));
    }
    return conv;
  }

  private async loadHistory(conversationId: string, limit: number) {
    const msgs = await this.msgRepo.find({
      where: { conversation_id: conversationId },
      order: { created_at: 'DESC' },
      take: limit + 1, // +1 để loại chính msg vừa lưu khi generate
    });
    return [...msgs].reverse().slice(-limit);
  }

  private async saveMessage(
    userId: string,
    conversationId: string,
    role: AiMessage['role'],
    content: string,
    toolCalls: Record<string, unknown>[] | null,
    tokensUsed: number | null,
    toolCallId: string | null = null,
  ) {
    const msg = this.msgRepo.create({
      user_id: userId,
      conversation_id: conversationId,
      role,
      content,
      tool_calls: toolCalls,
      tokens_used: tokensUsed,
      tool_call_id: toolCallId,
    });
    return this.msgRepo.save(msg);
  }

  private async touchConversation(id: string) {
    await this.convRepo.update(id, { updated_at: new Date() });
  }

  private async getGoalType(userId: string): Promise<string> {
    try {
      const user = await this.usersService.getMe(userId);
      const profile = user.profile as unknown as Record<string, unknown>;
      const goal = profile?.goal_type;
      return typeof goal === 'string' ? goal : 'MAINTAIN';
    } catch {
      return 'MAINTAIN';
    }
  }

  // Đọc string an toàn từ profile (tránh [object Object] trong prompt).
  private pv(profile: Record<string, unknown>, key: string): string {
    const v = profile[key];
    return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
  }

  private num(v: unknown, fallback: number): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  // Pre-injection: fetch sẵn profile + kcal hôm nay (query local rẻ),
  // nhét thẳng vào system prompt thay vì tool-calling tốn 2x token.
  private async buildContext(userId: string): Promise<PreInjectedContext> {
    const today = new Date().toISOString().split('T')[0];
    const lang = this.i18n.lang();
    const en = lang === 'en';
    try {
      const user = await this.usersService.getMe(userId);
      const profile = (user.profile ?? {}) as unknown as Record<
        string,
        unknown
      >;
      const allergies =
        user.allergies?.map((a) => a.allergen_name).filter(Boolean) ?? [];

      const displayName = this.pv(profile, 'full_name') || (en ? 'you' : 'bạn');
      const age = this.calcAge(profile.date_of_birth);
      const gender = this.pv(profile, 'gender');
      const height = this.pv(profile, 'height_cm');
      const weight = this.pv(profile, 'current_weight_kg');
      const activity = this.pv(profile, 'activity_level');
      const profileLine = [
        displayName,
        age ? (en ? `${age} years old` : `${age} tuổi`) : '',
        gender ? (en ? `gender ${gender}` : `giới tính ${gender}`) : '',
        height ? (en ? `height ${height}cm` : `cao ${height}cm`) : '',
        weight ? (en ? `weight ${weight}kg` : `nặng ${weight}kg`) : '',
        activity ? (en ? `activity ${activity}` : `vận động ${activity}`) : '',
      ]
        .filter(Boolean)
        .join(', ');
      const allergyLine =
        allergies.length > 0
          ? en
            ? `STRICTLY avoid allergens: ${allergies.join(', ')}.`
            : `Dị ứng TUYỆT ĐỐI tránh: ${allergies.join(', ')}.`
          : en
            ? 'No recorded allergies.'
            : 'Không có dị ứng ghi nhận.';
      const diet = this.pv(profile, 'diet_type') || 'STANDARD';

      const dashboard = await this.nutritionService
        .getDailyDashboard(userId, today)
        .catch(() => null);
      const consumed = this.num(dashboard?.total_kcal, 0);
      const target = this.num(profile.daily_kcal_target, 1800);
      const remaining = Math.max(0, target - consumed);
      const kcalLine = en
        ? `Budget ${today}: target ${target} kcal, consumed ${consumed} kcal, remaining ${remaining} kcal. Diet: ${diet}.`
        : `Ngân sách ${today}: mục tiêu ${target} kcal, ` +
          `đã nạp ${consumed} kcal, còn lại ${remaining} kcal. ` +
          `Chế độ ăn: ${diet}.`;

      let macroLine = '';
      try {
        const t = (await this.nutritionService.getMacroTargets(
          userId,
        )) as unknown as Record<string, unknown>;
        const p = this.num(t.target_protein_g, 0);
        const c = this.num(t.target_carbs_g, 0);
        const f = this.num(t.target_fat_g, 0);
        if (p && c && f) {
          macroLine = en
            ? `Daily macros: protein ${p}g, carbs ${c}g, fat ${f}g.`
            : `Macro/ngày: đạm ${p}g, bột ${c}g, béo ${f}g.`;
        }
      } catch {
        macroLine = '';
      }

      const goalType = this.pv(profile, 'goal_type') || 'MAINTAIN';
      return {
        displayName,
        profileLine,
        allergyLine,
        kcalLine,
        macroLine,
        goalType,
        today,
      };
    } catch {
      return {
        displayName: en ? 'you' : 'bạn',
        profileLine: '',
        allergyLine: '',
        kcalLine: '',
        macroLine: '',
        goalType: 'MAINTAIN',
        today,
      };
    }
  }

  private calcAge(dob: unknown): number | undefined {
    if (typeof dob !== 'string' && !(dob instanceof Date)) return undefined;
    const d = new Date(dob);
    if (Number.isNaN(d.getTime())) return undefined;
    return new Date().getFullYear() - d.getFullYear();
  }

  private async persistTrace(
    userId: string,
    conversationId: string,
    trace: ToolTraceStep[],
  ) {
    for (const step of trace) {
      await this.saveMessage(
        userId,
        conversationId,
        'assistant',
        step.assistantContent,
        step.toolCalls as unknown as Record<string, unknown>[],
        null,
      );
      for (const r of step.results) {
        await this.saveMessage(
          userId,
          conversationId,
          'tool',
          r.content,
          null,
          null,
          r.id,
        );
      }
    }
  }

  private async generateReply(
    userId: string,
    conversationId: string,
    currentMessage: string,
  ): Promise<{
    reply: string;
    tokensUsed: number | null;
    trace: ToolTraceStep[];
  }> {
    const lang = this.i18n.lang();
    const ctx = await this.buildContext(userId);
    const systemPrompt = buildSystemPrompt(ctx, lang);
    const history = await this.loadHistory(conversationId, CHAT_HISTORY_LIMIT);

    const messages: ChatMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];
    for (const m of history) {
      if (m.role === 'user') {
        // Bỏ msg hiện tại khỏi history (đã lưu nhưng sẽ append riêng)
        if (m.content === currentMessage) continue;
        messages.push({ role: 'user', content: m.content });
      } else if (m.role === 'assistant') {
        messages.push({
          role: 'assistant',
          content: m.content,
          tool_calls: (m.tool_calls ?? undefined) as ChatToolCall[] | undefined,
        });
      } else if (m.role === 'tool') {
        messages.push({
          role: 'tool',
          content: m.content,
          tool_call_id: m.tool_call_id ?? 'unknown',
        });
      }
    }
    messages.push({ role: 'user', content: currentMessage });

    let tokensUsed: number | null = null;
    const trace: ToolTraceStep[] = [];
    // Vòng tool loop tối đa 2 lượt (chỉ 2 tools hiếm).
    for (let iter = 0; iter < 2; iter++) {
      let completion: Groq.Chat.ChatCompletion;
      try {
        completion = await this.groq.chat.completions.create({
          messages,
          model: this.model,
          temperature: 0.4,
          max_tokens: CHAT_MAX_TOKENS,
          tools: buildChatTools(lang),
          tool_choice: 'auto',
        });
      } catch (e) {
        if (this.isRateLimit(e)) throw e;
        this.logger.error('Lỗi Groq chat:', e);
        throw new InternalServerErrorException(this.i18n.t('ai.replyFailed'));
      }

      const choice = completion.choices[0]?.message;
      if (!choice)
        throw new InternalServerErrorException(this.i18n.t('ai.emptyReply'));
      tokensUsed = completion.usage?.total_tokens ?? tokensUsed;

      const toolCalls = choice.tool_calls;
      if (!toolCalls?.length) {
        const reply = (choice.content ?? '').trim();
        if (!reply)
          throw new InternalServerErrorException(this.i18n.t('ai.emptyReply'));
        return { reply, tokensUsed, trace };
      }

      // Giữ raw tool_calls để replay đúng format OpenAI/Groq.
      messages.push({
        role: 'assistant',
        content: choice.content ?? '',
        tool_calls: toolCalls,
      });
      const step: ToolTraceStep = {
        assistantContent: choice.content ?? '',
        toolCalls,
        results: [],
      };
      for (const tc of toolCalls) {
        const args = this.parseToolArgs(tc.function.arguments);
        const result = await this.executeTool(userId, tc.function.name, args);
        const content = truncateForPrompt(JSON.stringify(result));
        step.results.push({ id: tc.id, name: tc.function.name, content });
        messages.push({
          role: 'tool',
          content,
          tool_call_id: tc.id,
        });
      }
      trace.push(step);
    }

    // Hết vòng tool mà chưa có text: gọi chốt 1 lần không tools.
    const final = await this.groq.chat.completions.create({
      messages,
      model: this.model,
      temperature: 0.4,
      max_tokens: CHAT_MAX_TOKENS,
    });
    const reply = (final.choices[0]?.message?.content ?? '').trim();
    if (!reply)
      throw new InternalServerErrorException(this.i18n.t('ai.emptyReply'));
    tokensUsed = final.usage?.total_tokens ?? tokensUsed;
    return { reply, tokensUsed, trace };
  }

  private parseToolArgs(raw: unknown): Record<string, unknown> {
    if (typeof raw !== 'string') return {};
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }

  private async executeTool(
    userId: string,
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      if (name === 'get_recent_logs') {
        const days = Math.min(Math.max(this.num(args.days, 7), 1), 7);
        const logs = await this.logRepo.find({
          where: { user_id: userId },
          order: { log_date: 'DESC' },
          take: days,
        });
        return logs.map((l) => ({
          date: l.log_date,
          water_ml: l.water_consumed_ml,
          kcal_in: l.total_kcal_in,
          kcal_out: l.total_kcal_out,
          weight: l.weight_log,
        }));
      }
      if (name === 'get_workout_history') {
        const limit = Math.min(Math.max(this.num(args.limit, 5), 1), 5);
        const items = await this.workoutRepo.find({
          where: { user_id: userId },
          order: { date: 'DESC' },
          take: limit,
        });
        return items.map((w) => ({
          date: w.date,
          activity: w.activity_type,
          minutes: w.duration_minutes,
          burned_kcal: w.burned_kcal,
        }));
      }
      return { error: `Unknown tool: ${name}` };
    } catch (e) {
      this.logger.warn(`Tool ${name} thất bại: ${e}`);
      return { error: 'Không lấy được dữ liệu lúc này.' };
    }
  }

  private isRateLimit(e: unknown): boolean {
    if (!e || typeof e !== 'object') return false;
    const err = e as ToolError;
    const status = err.status ?? err.statusCode;
    const code = err.code ?? err.error?.code;
    return status === 429 || code === 'rate_limit_exceeded';
  }
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { AiConversation } from './ai-conversation.entity';

export type AiChatRole = 'user' | 'assistant' | 'system' | 'tool';

@Entity('ai_messages')
@Index(['conversation_id', 'created_at'])
export class AiMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  conversation_id!: string;

  @ManyToOne('AiConversation', 'messages', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: AiConversation;

  @Column('uuid')
  user_id!: string;

  @Column({ type: 'varchar', length: 20 })
  role!: AiChatRole;

  @Column({ type: 'text' })
  content!: string;

  // Lưu raw JSON tool_calls của Groq (id, type, function.name, function.arguments)
  // để replay history không lỗi validation.
  @Column({ type: 'jsonb', nullable: true })
  tool_calls!: Record<string, unknown>[] | null;

  // Bắt buộc khi role='tool' (nối kết quả với tool_call tương ứng).
  @Column({ type: 'varchar', length: 100, nullable: true })
  tool_call_id!: string | null;

  @Column({ type: 'int', nullable: true })
  tokens_used!: number | null;

  @CreateDateColumn()
  created_at!: Date;
}

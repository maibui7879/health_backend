import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { LinkedType } from '../entities/post.entity';
import { ReactionType } from '../entities/reaction.entity';

export class CreatePostDto {
  @ApiProperty({ example: 'Hôm nay meal-prep ức gà + rau củ, 550 kcal!' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;

  @ApiPropertyOptional({ example: 'https://.../meal.jpg' })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  image_url?: string;

  @ApiPropertyOptional({
    enum: LinkedType,
    example: LinkedType.NUTRITION_PLAN,
    description: 'Gắn kèm thực đơn / buổi tập / bữa ăn. Cần cả type + id.',
  })
  @IsOptional()
  @IsEnum(LinkedType)
  linked_type?: LinkedType;

  @ApiPropertyOptional({
    description: 'ID của plan / workout / meal được gắn.',
  })
  @IsOptional()
  @IsUUID()
  linked_id?: string;
}

export class UpdatePostDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  image_url?: string;
}

export class FeedQueryDto {
  @ApiPropertyOptional({ example: 20, description: 'Tối đa 50.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class CreateCommentDto {
  @ApiProperty({ example: 'Nhìn ngon quá, xin công thức với!' })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content!: string;
}

export class UpdateCommentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content!: string;
}

export class ReactDto {
  @ApiPropertyOptional({ enum: ReactionType, example: ReactionType.LIKE })
  @IsOptional()
  @IsIn([ReactionType.LIKE])
  type?: ReactionType;
}

export class ReportPostDto {
  @ApiProperty({ example: 'Nội dung spam / không phù hợp' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class RecordViewsDto {
  @ApiProperty({
    example: ['2f8d9ae5-5d2c-4d9a-a41b-ec0e1dca5f50'],
    description: 'Batch bài đã hiển thị trên màn hình (tối đa 50).',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  post_ids!: string[];
}

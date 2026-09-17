import { PartialType } from '@nestjs/swagger';
import { CreateDailyLogDto } from './create-daily-log.dto';

export class UpdateDailyLogDto extends PartialType(CreateDailyLogDto) {}

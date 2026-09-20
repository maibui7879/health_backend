import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private groq: Groq;

  constructor(private configService: ConfigService) {
    this.groq = new Groq({
      apiKey: this.configService.get<string>('GROQ_API_KEY'),
    });
  }

  async analyzeFoodImage(
    imageBuffer: Buffer,
    mimeType: string,
    userAllergies: string[] = [],
    dietType: string = 'STANDARD',
    weight_g?: number,
    additional_info?: string,
  ): Promise<Record<string, unknown>> {
    try {
      const base64Image = imageBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64Image}`;

      let allergyContext = '';
      if (userAllergies.length > 0) {
        allergyContext = `
				CẢNH BÁO Y TẾ NGHIÊM TRỌNG: Người dùng đang bị dị ứng với các thành phần sau: ${userAllergies.join(', ')}.
				Hãy phân tích cực kỳ cẩn thận các nguyên liệu ẩn, phụ gia (E-number) có thể liên quan đến các chất dị ứng này.
				`;
      } else {
        allergyContext = 'Người dùng hiện tại không có tiền sử dị ứng nào.';
      }

      let extraContext = '';
      if (weight_g) {
        extraContext += `- Khối lượng thực tế: ${weight_g} gram.\n`;
      }
      if (additional_info) {
        extraContext += `- Ghi chú của người dùng: "${additional_info}".\n`;
      }

      let dietContext = '';
      if (dietType !== 'STANDARD') {
        dietContext = `CẢNH BÁO CHẾ ĐỘ ĂN: Người dùng đang theo chế độ ăn ${dietType}. Hãy kiểm tra nghiêm ngặt xem món ăn này có vi phạm quy tắc của chế độ ${dietType} hay không.`;
      }

      const prompt = `
				Bạn là một chuyên gia dinh dưỡng và an toàn thực phẩm. Hãy phân tích món ăn trong ảnh.
				${allergyContext}
				${dietContext}
				${extraContext}

				Nhiệm vụ:
				1. Nhận diện món ăn và liệt kê chi tiết các nguyên liệu (bao gồm cả gia vị, phụ gia có thể có).
				2. Ước tính lượng Kcal.
				3. Đối chiếu nguyên liệu với danh sách dị ứng và chế độ ăn của người dùng để đưa ra kết luận an toàn.
				4. Nếu món ăn chứa chất dị ứng HOẶC vi phạm chế độ ăn ${dietType}, hãy đánh dấu is_safe_for_user = false và giải thích rõ trong warnings.

				BẮT BUỘC trả về định dạng JSON chính xác như sau, không kèm bất kỳ văn bản nào khác:
				{
				  "food_name_vi": "Tên món ăn",
				  "food_name_en": "English name",
				  "estimated_kcal": 0,
				  "is_safe_for_user": true/false,
				  "warnings": ["Liệt kê các cảnh báo nguy hiểm nếu is_safe_for_user là false, ví dụ: 'Món ăn có chứa đậu phộng'"],
				  "ingredients": [
				    {
				      "name": "Tên nguyên liệu (Tiếng Việt)",
				      "is_allergen": true/false
				    }
				  ]
				}
			`;

      const completion = await this.groq.chat.completions.create({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        model: 'qwen/qwen3.8-27b',
        temperature: 0.1,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) throw new Error('Kết quả trả về rỗng');

      const parsed = JSON.parse(responseContent) as Record<string, unknown>;
      return parsed;
    } catch (error) {
      this.logger.error('Lỗi khi gọi Groq AI:', error);
      throw new InternalServerErrorException(
        'Không thể phân tích hình ảnh lúc này.',
      );
    }
  }

  async suggestMenu(args: {
    userAllergies?: string[];
    dietType?: string;
    kcalTarget: number;
    mealType?: string;
    goalType?: string;
    age?: number;
    gender?: string;
    weightKg?: number;
    consumedKcal?: number;
    remainingKcal?: number;
    macroProteinG?: number;
    macroCarbsG?: number;
    macroFatG?: number;
    note?: string;
  }): Promise<Record<string, unknown>> {
    const {
      userAllergies = [],
      dietType = 'STANDARD',
      kcalTarget,
      mealType,
      goalType = 'MAINTAIN',
      age,
      gender,
      weightKg,
      consumedKcal = 0,
      remainingKcal,
      macroProteinG,
      macroCarbsG,
      macroFatG,
      note,
    } = args;
    try {
      const allergyContext =
        userAllergies.length > 0
          ? `TUYỆT ĐỐI KHÔNG dùng các thành phần: ${userAllergies.join(', ')}.`
          : 'Người dùng không có dị ứng.';
      const scope = mealType
        ? `Gợi ý 2-3 món cho bữa ${mealType}`
        : 'Gợi ý thực đơn cả ngày gồm 3 bữa chính (sáng, trưa, tối)';

      const goalGuide: Record<string, string> = {
        LOSE_WEIGHT:
          'giảm cân: thâm hụt calo, ưu tiên đạm nạc, rau xanh, hạn chế dầu mỡ và đường',
        GAIN_MUSCLE:
          'tăng cơ: giàu đạm (thịt, cá, trứng, đậu), đủ tinh bột tốt, đặc biệt quanh buổi tập',
        MAINTAIN: 'giữ dáng: cân bằng đạm – tinh bột – chất béo',
      };
      const who = [
        age ? `${age} tuổi` : '',
        gender ? `giới tính ${gender}` : '',
        weightKg ? `nặng ${weightKg}kg` : '',
        `mục tiêu ${goalGuide[goalType] ?? goalGuide.MAINTAIN}`,
      ]
        .filter(Boolean)
        .join(', ');
      const budget =
        remainingKcal !== undefined
          ? `Hôm nay đã nạp ${consumedKcal} kcal, còn lại khoảng ${remainingKcal} kcal trong ngân sách.`
          : '';
      const macroLine =
        macroProteinG && macroCarbsG && macroFatG
          ? `Mục tiêu macro/ngày: đạm ${macroProteinG}g, tinh bột ${macroCarbsG}g, béo ${macroFatG}g.`
          : '';
      const noteLine = note?.trim()
        ? `Yêu cầu cụ thể của người dùng: "${note.trim()}".`
        : '';

      const prompt = `
				Bạn là chuyên gia dinh dưỡng Việt Nam.
				Người dùng: ${who}.
				${allergyContext}
				Chế độ ăn: ${dietType}.
				${budget}
				${macroLine}
				${noteLine}
				${scope} với tổng khoảng ${kcalTarget} kcal, ưu tiên món Việt dễ nấu.
				Mỗi món ghi rõ lý do ngắn gọn gắn với mục tiêu và macro của người dùng.

				BẮT BUỘC trả về JSON chính xác như sau, không kèm văn bản nào khác:
				{
				  "meal_type": "${mealType ?? 'LUNCH'}",
				  "total_kcal": 0,
				  "items": [
				    {
				      "food_name_vi": "Tên món",
				      "food_name_en": "English name",
				      "estimated_kcal": 0,
				      "reason": "Lý do ngắn gọn"
				    }
				  ]
				}
			`;

      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'qwen/qwen3.8-27b',
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) throw new Error('Kết quả trả về rỗng');

      const parsed = JSON.parse(responseContent) as Record<string, unknown>;
      return parsed;
    } catch (error) {
      this.logger.error('Lỗi khi gợi ý món ăn:', error);
      throw new InternalServerErrorException(
        'Không thể gợi ý thực đơn lúc này.',
      );
    }
  }

  async suggestPlan(args: {
    userAllergies?: string[];
    dietType?: string;
    goalType?: string;
    age?: number;
    gender?: string;
    heightCm?: number;
    weightKg?: number;
    activityLevel?: string;
    dailyKcalTarget?: number;
    macroProteinG?: number;
    macroCarbsG?: number;
    macroFatG?: number;
    durationDays?: number;
  }): Promise<Record<string, unknown>> {
    const {
      userAllergies = [],
      dietType = 'STANDARD',
      goalType = 'MAINTAIN',
      age,
      gender,
      heightCm,
      weightKg,
      activityLevel,
      dailyKcalTarget = 1800,
      macroProteinG,
      macroCarbsG,
      macroFatG,
      durationDays = 7,
    } = args;
    try {
      const allergyContext =
        userAllergies.length > 0
          ? `TUYỆT ĐỐI KHÔNG dùng các thành phần: ${userAllergies.join(', ')}.`
          : 'Người dùng không có dị ứng.';
      const goalGuide: Record<string, string> = {
        LOSE_WEIGHT:
          'giảm cân: thâm hụt ~500 kcal/ngày, ưu tiên đạm nạc và rau xanh',
        GAIN_MUSCLE:
          'tăng cơ: thặng dư nhẹ, giàu đạm, tập sức mạnh 3-4 buổi/tuần',
        MAINTAIN: 'giữ dáng: cân bằng dinh dưỡng và vận động đều',
      };
      const who = [
        age ? `${age} tuổi` : '',
        gender ?? '',
        heightCm ? `cao ${heightCm}cm` : '',
        weightKg ? `nặng ${weightKg}kg` : '',
        activityLevel ? `vận động ${activityLevel}` : '',
        `mục tiêu ${goalGuide[goalType] ?? goalGuide.MAINTAIN}`,
      ]
        .filter(Boolean)
        .join(', ');
      const macroLine =
        macroProteinG && macroCarbsG && macroFatG
          ? `Macro/ngày: đạm ${macroProteinG}g, tinh bột ${macroCarbsG}g, béo ${macroFatG}g.`
          : '';

      const prompt = `
				Bạn là huấn luyện viên dinh dưỡng và thể hình.
				Người dùng: ${who}.
				${allergyContext}
				Chế độ ăn: ${dietType}. Mục tiêu năng lượng: ${dailyKcalTarget} kcal/ngày.
				${macroLine}
				Hãy lập kế hoạch ${durationDays} ngày gồm bữa ăn (sáng/trưa/tối + kcal) và buổi tập mỗi ngày,
				ước tính số tuần để đạt mục tiêu. Viết ngắn gọn, món Việt dễ thực hiện.

				BẮT BUỘC trả về JSON chính xác như sau, không kèm văn bản nào khác:
				{
				  "duration_days": ${durationDays},
				  "goal_summary": "Tóm tắt 1 câu",
				  "estimated_weeks": 0,
				  "days": [
				    {
				      "day": 1,
				      "meals": [
				        { "meal_type": "BREAKFAST", "suggestion": "Tên món", "kcal": 0 }
				      ],
				      "workout": { "activity": "Tên bài tập", "duration_minutes": 0, "note": "Ghi chú" },
				      "tip": "Mẹo ngắn"
				    }
				  ]
				}
			`;

      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'qwen/qwen3.8-27b',
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) throw new Error('Kết quả trả về rỗng');

      const parsed = JSON.parse(responseContent) as Record<string, unknown>;
      return parsed;
    } catch (error) {
      this.logger.error('Lỗi khi gợi ý kế hoạch:', error);
      throw new InternalServerErrorException(
        'Không thể gợi ý kế hoạch lúc này.',
      );
    }
  }
}

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
        model: 'llama-3.2-90b-vision-preview',
        temperature: 0.1,
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
}

// Từ điển tiếng Việt — nguồn sự thật cho key (TranslationKey suy ra từ đây).
export const vi = {
  'auth.emailInUse': 'Email này đã được sử dụng.',
  'auth.invalidCredentials': 'Email hoặc mật khẩu không đúng.',
  'auth.invalidRefreshToken': 'Refresh token không hợp lệ.',
  'auth.invalidAccessToken': 'Access token không hợp lệ.',
  'auth.invalidGoogleToken': 'Token không hợp lệ hoặc không có email',
  'auth.googleTokenExpired': 'Google ID Token không hợp lệ hoặc đã hết hạn.',

  'users.notFound': 'Không tìm thấy người dùng',
  'users.profileNotFound': 'Không tìm thấy profile',
  'users.allergiesUpdated': 'Cập nhật dị ứng thành công',
  'users.deviceTokenUpdated': 'Cập nhật Device Token thành công',
  'users.accountDeleted': 'Tài khoản và toàn bộ dữ liệu đã được xóa vĩnh viễn',

  'tracking.dateRequired': 'Thiếu tham số date',
  'tracking.logNotFound': 'Không tìm thấy nhật ký ngày',
  'tracking.logDeleted': 'Đã xóa nhật ký ngày thành công',

  'nutrition.mealNotFound': 'Không tìm thấy bữa ăn',
  'nutrition.mealForbidden': 'Bạn không có quyền xóa bữa ăn này',
  'nutrition.mealDeleted': 'Đã xóa bữa ăn và cập nhật lại Calories',
  'nutrition.profileRequired': 'Chưa cập nhật Profile',

  'workout.notFound': 'Không tìm thấy bài tập',
  'workout.deleted': 'Đã xóa bài tập và cập nhật lại Calo đốt cháy',

  'ai.imageRequired': 'Vui lòng đính kèm một hình ảnh món ăn.',
  'ai.imageTypeOnly': 'Chỉ chấp nhận ảnh (jpg, png, webp)',
  'ai.analyzeOk': 'Nhận diện thành công',
  'ai.menuOk': 'Gợi ý thực đơn thành công',
  'ai.planOk': 'Gợi ý kế hoạch thành công',
  'ai.analyzeFailed': 'Không thể phân tích hình ảnh lúc này.',
  'ai.menuFailed': 'Không thể gợi ý thực đơn lúc này.',
  'ai.planFailed': 'Không thể gợi ý kế hoạch lúc này.',
  'ai.planOverloaded':
    'AI đang quá tải (Groq giới hạn 1000 tokens/phút). Vui lòng thử lại sau ít phút hoặc giảm số ngày (ví dụ duration_days=3).',
  'ai.replyFailed': 'Không thể trả lời lúc này, vui lòng thử lại.',
  'ai.emptyReply': 'AI trả về rỗng.',
  'ai.overloaded':
    'AI đang quá tải (Groq giới hạn 1000 tokens/phút). Vui lòng thử lại sau ít phút.',
  'ai.overloadedRetry': 'AI đang quá tải. Vui lòng thử lại sau ít phút.',
  'ai.nothingToRetry': 'Hội thoại chưa có tin nhắn nào để thử lại.',
  'ai.conversationNotFound': 'Không tìm thấy hội thoại',
  'ai.conversationForbidden': 'Bạn không có quyền truy cập hội thoại này',
  'ai.conversationDeleted': 'Đã xóa hội thoại',
  'ai.newConversation': 'Hội thoại mới',

  'common.created': 'Tạo dữ liệu thành công',
  'common.updated': 'Cập nhật dữ liệu thành công',
  'common.deleted': 'Xóa dữ liệu thành công',
  'common.fetched': 'Lấy dữ liệu thành công',
  'common.internalError': 'Lỗi hệ thống, vui lòng thử lại sau.',
  'common.genericError': 'Có lỗi xảy ra',
} as const;

export type TranslationKey = keyof typeof vi;

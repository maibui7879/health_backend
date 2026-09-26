import type { TranslationKey } from './vi';

// Bắt buộc đủ key với vi.ts — thiếu key sẽ lỗi compile.
export const en: Record<TranslationKey, string> = {
  'auth.emailInUse': 'This email is already in use.',
  'auth.invalidCredentials': 'Incorrect email or password.',
  'auth.invalidRefreshToken': 'Invalid refresh token.',
  'auth.invalidAccessToken': 'Invalid access token.',
  'auth.invalidGoogleToken': 'Invalid token or missing email',
  'auth.googleTokenExpired': 'Google ID token is invalid or expired.',

  'users.notFound': 'User not found',
  'users.profileNotFound': 'Profile not found',
  'users.allergiesUpdated': 'Allergies updated successfully',
  'users.deviceTokenUpdated': 'Device token updated successfully',
  'users.accountDeleted': 'Account and all data have been permanently deleted',

  'tracking.dateRequired': 'Missing date parameter',
  'tracking.logNotFound': 'Daily log not found',
  'tracking.logDeleted': 'Daily log deleted successfully',

  'nutrition.mealNotFound': 'Meal not found',
  'nutrition.mealForbidden': 'You are not allowed to delete this meal',
  'nutrition.mealDeleted': 'Meal deleted and calories updated',
  'nutrition.profileRequired': 'Profile has not been set up yet',

  'workout.notFound': 'Workout not found',
  'workout.deleted': 'Workout deleted and burned calories updated',

  'ai.imageRequired': 'Please attach a food photo.',
  'ai.imageTypeOnly': 'Only images are accepted (jpg, png, webp)',
  'ai.analyzeOk': 'Recognition successful',
  'ai.menuOk': 'Menu suggestion successful',
  'ai.planOk': 'Plan suggestion successful',
  'ai.analyzeFailed': 'Unable to analyze the image right now.',
  'ai.menuFailed': 'Unable to suggest a menu right now.',
  'ai.planFailed': 'Unable to suggest a plan right now.',
  'ai.planOverloaded':
    'AI is overloaded (Groq limit: 1000 tokens/min). Please try again in a few minutes or reduce the number of days (e.g. duration_days=3).',
  'ai.replyFailed': 'Unable to reply right now, please try again.',
  'ai.emptyReply': 'AI returned an empty response.',
  'ai.overloaded':
    'AI is overloaded (Groq limit: 1000 tokens/min). Please try again in a few minutes.',
  'ai.overloadedRetry': 'AI is overloaded. Please try again in a few minutes.',
  'ai.nothingToRetry': 'This conversation has no messages to retry.',
  'ai.conversationNotFound': 'Conversation not found',
  'ai.conversationForbidden': 'You are not allowed to access this conversation',
  'ai.conversationDeleted': 'Conversation deleted',
  'ai.newConversation': 'New conversation',

  'common.created': 'Created successfully',
  'common.updated': 'Updated successfully',
  'common.deleted': 'Deleted successfully',
  'common.fetched': 'Fetched successfully',
  'common.internalError': 'System error, please try again later.',
  'common.genericError': 'Something went wrong',
};

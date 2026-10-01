import { Injectable, Logger } from '@nestjs/common';
import { Expo } from 'expo-server-sdk';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly expo = new Expo();

  isPushToken(token: unknown): token is string {
    return typeof token === 'string' && Expo.isExpoPushToken(token);
  }

  async sendMany(
    messages: { to: string; title: string; body: string }[],
  ): Promise<{ sent: number; invalidTokens: string[] }> {
    const chunks = this.expo.chunkPushNotifications(messages);
    let sent = 0;
    const invalidTokens: string[] = [];
    for (const chunk of chunks) {
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.forEach((ticket, i) => {
          if (ticket.status === 'ok') {
            sent += 1;
          } else if (ticket.details?.error === 'DeviceNotRegistered') {
            invalidTokens.push(chunk[i]?.to as string);
          } else {
            this.logger.warn(
              `Push ticket error: ${ticket.details?.error ?? 'unknown'}`,
            );
          }
        });
      } catch (error) {
        this.logger.error(`Gửi push thất bại: ${String(error)}`);
      }
    }
    return { sent, invalidTokens };
  }
}

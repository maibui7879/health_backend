import { Injectable, Logger } from '@nestjs/common';
import { Expo } from 'expo-server-sdk';
import { GoogleAuth } from 'google-auth-library';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly expo = new Expo();

  isPushToken(token: unknown): token is string {
    return (
      typeof token === 'string' &&
      ((token.length >= 20 && /^[A-Za-z0-9_:.-]+$/.test(token)) ||
        Expo.isExpoPushToken(token))
    );
  }

  async sendMany(
    messages: { to: string; title: string; body: string }[],
  ): Promise<{ sent: number; invalidTokens: string[] }> {
    const expoMessages = messages.filter((m) => Expo.isExpoPushToken(m.to));
    const fcmMessages = messages.filter((m) => !Expo.isExpoPushToken(m.to));
    const chunks = this.expo.chunkPushNotifications(expoMessages);
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
    if (fcmMessages.length > 0) {
      try {
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        if (!raw) {
          this.logger.warn(
            'FIREBASE_SERVICE_ACCOUNT_JSON missing; FCM delivery unavailable.',
          );
          return { sent, invalidTokens };
        }
        const credentials = JSON.parse(raw) as {
          project_id: string;
          client_email: string;
          private_key: string;
        };
        const auth = new GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
        });
        const accessToken = await auth.getAccessToken();
        for (const message of fcmMessages) {
          const response = await fetch(
            `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(credentials.project_id)}/messages:send`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                message: {
                  token: message.to,
                  notification: { title: message.title, body: message.body },
                },
              }),
              signal: AbortSignal.timeout(15000),
            },
          );
          if (response.ok) sent++;
          else {
            const error = (await response.json()) as {
              error?: { details?: { errorCode?: string }[] };
            };
            if (
              error.error?.details?.some((d) => d.errorCode === 'UNREGISTERED')
            )
              invalidTokens.push(message.to);
            else this.logger.warn(`FCM send failed: ${response.status}`);
          }
        }
      } catch (error) {
        this.logger.error(`FCM delivery failed: ${String(error)}`);
      }
    }
    return { sent, invalidTokens };
  }
}

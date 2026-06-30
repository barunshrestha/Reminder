import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { NotificationDispatcherService } from "./notification-dispatcher.service";

class PushSubscribeDto {
  endpoint!: string;
  keys!: { p256dh: string; auth: string };
}

class UpdatePreferencesDto {
  pushEnabled?: boolean;
  importFailures?: boolean;
  reminderRunFailures?: boolean;
}

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationDispatcherService) {}

  @Get("vapid-public-key")
  getVapidPublicKey() {
    return { publicKey: this.notifications.getPublicVapidKey() };
  }

  @UseGuards(JwtAuthGuard)
  @Get("preferences")
  getPreferences(@CurrentUser() user: { id: string }) {
    return this.notifications.getPreferences(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("preferences")
  async updatePreferences(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdatePreferencesDto,
  ) {
    await this.notifications.updatePreferences(user.id, dto);
    return this.notifications.getPreferences(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("push-subscribe")
  async subscribe(
    @CurrentUser() user: { id: string },
    @Body() body: PushSubscribeDto,
  ) {
    await this.notifications.upsertSubscription(user.id, {
      endpoint: body.endpoint,
      keys: body.keys,
    });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Delete("push-subscribe")
  async unsubscribe(
    @CurrentUser() user: { id: string },
    @Body() body: { endpoint?: string },
  ) {
    await this.notifications.removeSubscription(user.id, body?.endpoint);
    return { ok: true };
  }
}

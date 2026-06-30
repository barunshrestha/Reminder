import { Controller, Get, Post, Query, Body } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import { SkipTenant } from "../tenancy/tenancy.decorator";
import { UnsubscribeService } from "./unsubscribe.service";

@Controller("public/unsubscribe")
@Public()
@SkipTenant()
export class UnsubscribeController {
  constructor(private readonly service: UnsubscribeService) {}

  @Get()
  getUnsubscribe(
    @Query("email") email: string,
    @Query("invoice") invoice?: string,
  ) {
    return this.service.unsubscribeByEmail(email, invoice);
  }

  @Post()
  postUnsubscribe(
    @Body() body: { email: string; invoice_number?: string },
  ) {
    return this.service.unsubscribeByEmail(body.email, body.invoice_number);
  }
}

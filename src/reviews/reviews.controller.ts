import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.role.enum';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT)
  findMyReviews(@Request() req: any) {
    return this.reviewsService.findMyReviews(req.user.userId);
  }

  @Get('food-item/:foodItemId')
  findByFoodItem(@Param('foodItemId') foodItemId: string) {
    return this.reviewsService.findByFoodItem(foodItemId);
  }

  @Get('kitchen/:kitchenId')
  findByKitchen(@Param('kitchenId') kitchenId: string) {
    return this.reviewsService.findByKitchen(kitchenId);
  }
}

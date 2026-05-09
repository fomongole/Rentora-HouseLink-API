import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { FilterBookingsDto } from './dto/filter-bookings.dto';
import { ConfirmBookingDto } from './dto/confirm-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { CancelByRenterDto } from './dto/cancel-by-renter.dto';
import { SyncBookingsDto } from './dto/sync-bookings.dto';

@ApiTags('Bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // ── Public (mobile app) ───────────────────────────────────────────────────

  /**
   * Called by the Flutter mobile app when a renter submits a booking request.
   * No authentication required.
   */
  @Post()
  @ApiOperation({ summary: 'Submit a booking request (public — mobile app)' })
  create(@Body() dto: CreateBookingDto) {
    return this.bookingsService.create(dto);
  }

  /**
   * Renter cancels their own booking — identified by bookingId.
   * No auth (they don't have accounts). In future, add an OTP or phone verification.
   */
  @Patch(':id/cancel-by-renter')
  @ApiOperation({ summary: 'Renter cancels their booking using their cancellation token (public)' })
  cancelByRenter(
    @Param('id') id: string,
    @Body() dto: CancelByRenterDto,
  ) {
    return this.bookingsService.cancelByRenter(id, dto);
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all bookings with optional filters (admin only)' })
  findAll(@Query() filters: FilterBookingsDto) {
    return this.bookingsService.findAll(filters);
  }

  @Get('stats')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Booking statistics (admin only)' })
  getStats() {
    return this.bookingsService.getStats();
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get a single booking (admin only)' })
  findOne(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }

  @Patch(':id/confirm')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Confirm a pending booking (admin only)' })
  confirm(
    @Param('id') id: string,
    @Body() dto: ConfirmBookingDto,
    @CurrentUser() user: User,
  ) {
    return this.bookingsService.confirm(id, dto, user);
  }

  @Patch(':id/cancel')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin cancels a booking (admin only)' })
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user: User,
  ) {
    return this.bookingsService.cancel(id, dto, 'admin', user);
  }

  @Patch(':id/complete')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Mark a booking as completed (renter moved out) (admin only)' })
  complete(@Param('id') id: string, @CurrentUser() user: User) {
    return this.bookingsService.complete(id, user);
  }


  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all my bookings (authenticated renter)' })
  findMyBookings(@CurrentUser() user: User) {
    return this.bookingsService.findForUser(user.id);
  }

  @Post('sync')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Link guest bookings to account using cancellation tokens' })
  sync(@CurrentUser() user: User, @Body() dto: SyncBookingsDto) {
    return this.bookingsService.syncGuestBookings(user.id, dto);
  }
}
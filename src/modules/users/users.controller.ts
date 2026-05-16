import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from './enums/user-role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from './entities/user.entity';
import { TokenBlacklistService } from '../token-blacklist/token-blacklist.service';
import { Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenBlacklistService: TokenBlacklistService,
    private readonly jwtService: JwtService,
  ) {}

  // ── Own profile routes (any authenticated user) ───────────────────────────

  @Get('me')
  @ApiOperation({ summary: 'Get own profile' })
  getMe(@CurrentUser() user: User) {
    const { password: _p, ...rest } = user;
    return rest;
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own profile (name / email)' })
  updateProfile(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Patch('me/password')
  @ApiOperation({ summary: 'Change own password' })
  changePassword(@CurrentUser() user: User, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(user.id, dto, user);
  }

  /**
   * DELETE /users/me
   *
   * Schedules the account for permanent deletion after a 30-day grace period
   * and immediately invalidates the user's current JWT so they are logged out.
   *
   * Play Store compliance: users can delete their account and all associated
   * data directly from within the app without contacting support.
   */
  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request account deletion — schedules permanent deletion in 30 days and logs the user out immediately',
  })
  async deleteMyAccount(
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    // 1. Mark account for deletion and get the purge date
    const result = await this.usersService.requestDeletion(user.id);

    // 2. Immediately blacklist the current token so the user is logged out
    //    on the device that made the request (other sessions will also be
    //    rejected by the JWT strategy because scheduledPurgeAt is now set).
    const rawToken = req.headers.authorization?.replace('Bearer ', '');
    if (rawToken) {
      try {
        const decoded = this.jwtService.decode(rawToken) as {
          jti?: string;
          exp?: number;
        } | null;
        if (decoded?.jti && decoded?.exp) {
          await this.tokenBlacklistService.blacklist(decoded.jti, decoded.exp);
        }
      } catch {
        // Malformed token — ignore; the account is already scheduled for deletion
      }
    }

    return result;
  }

  // ── Admin-only routes ─────────────────────────────────────────────────────

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all users (admin only)' })
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new admin user (admin only)' })
  createAdmin(@Body() dto: CreateAdminDto, @CurrentUser() user: User) {
    return this.usersService.createAdmin(dto, user);
  }

  @Patch(':id/toggle-active')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Activate or deactivate a user account (admin only)' })
  toggleActive(@Param('id') id: string, @CurrentUser() user: User) {
    return this.usersService.toggleActive(id, user);
  }
}
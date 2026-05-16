import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt, randomUUID } from 'crypto';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction } from '../audit-logs/enums/audit-action.enum';
import { AuditEntity } from '../audit-logs/enums/audit-entity.enum';
import { TokenBlacklistService } from '../token-blacklist/token-blacklist.service';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { EmailService } from '../email/email.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly auditLogsService: AuditLogsService,
    private readonly tokenBlacklistService: TokenBlacklistService,
    private readonly emailService: EmailService,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetRepo: Repository<PasswordResetToken>,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.usersService.create(dto.name, dto.email, dto.password);
    return this.buildResponse(user);
  }

  /**
   * Renter-only login — used by the mobile app.
   * Admins are explicitly blocked here; they must use POST /auth/admin/login.
   * The error message is intentionally generic to prevent role enumeration.
   */
  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);

    // ── Audit failed attempt even when the user doesn't exist ──────────────
    if (!user) {
      await this.auditLogsService.log({
        action: AuditAction.LOGIN_FAILED,
        entity: AuditEntity.AUTH,
        entityTitle: `Failed login attempt for ${dto.email}`,
        // performedBy is unknown — use a placeholder that satisfies the type
        performedBy: { id: 'unknown', name: 'unknown', email: dto.email },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);

    if (!passwordMatch) {
      await this.auditLogsService.log({
        action: AuditAction.LOGIN_FAILED,
        entity: AuditEntity.AUTH,
        entityTitle: `Failed login attempt for ${user.email}`,
        performedBy: user,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // ── Block admins from the mobile app ───────────────────────────────────
    // Admins authenticate exclusively via POST /auth/admin/login.
    // Returning the same generic error prevents role enumeration.
    if (user.role === UserRole.ADMIN) {
      await this.auditLogsService.log({
        action: AuditAction.LOGIN_FAILED,
        entity: AuditEntity.AUTH,
        entityTitle: `Admin login attempt blocked on mobile endpoint for ${user.email}`,
        performedBy: user,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // ── Block accounts pending deletion ────────────────────────────────────
    // The token would be issued but rejected on every subsequent request anyway.
    // Failing here at login is cleaner and avoids the confusing half-authenticated state.
    if (user.scheduledPurgeAt) {
      await this.auditLogsService.log({
        action: AuditAction.LOGIN_FAILED,
        entity: AuditEntity.AUTH,
        entityTitle: `Login attempt on deletion-pending account for ${user.email}`,
        performedBy: user,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.auditLogsService.log({
      action: AuditAction.LOGIN,
      entity: AuditEntity.AUTH,
      entityTitle: `${user.name} logged in`,
      performedBy: user,
    });

    return this.buildResponse(user);
  }

  /**
   * Admin-only login — used exclusively by the web portal.
   * Renters are blocked here; they must use POST /auth/login.
   * Same generic error message to prevent role enumeration.
   */
  async adminLogin(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      await this.auditLogsService.log({
        action: AuditAction.LOGIN_FAILED,
        entity: AuditEntity.AUTH,
        entityTitle: `Failed admin login attempt for ${dto.email}`,
        performedBy: { id: 'unknown', name: 'unknown', email: dto.email },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);

    // ── Non-admins and wrong passwords get the same generic error ──────────
    if (!passwordMatch || user.role !== UserRole.ADMIN) {
      await this.auditLogsService.log({
        action: AuditAction.LOGIN_FAILED,
        entity: AuditEntity.AUTH,
        entityTitle: `Failed admin login attempt for ${user.email}`,
        performedBy: user,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated.');
    }

    await this.auditLogsService.log({
      action: AuditAction.LOGIN,
      entity: AuditEntity.AUTH,
      entityTitle: `Admin ${user.name} logged in via portal`,
      performedBy: user,
    });

    return this.buildResponse(user);
  }

  /**
   * Invalidate the user's current token.
   * Called by the logout endpoint after the token is decoded from the cookie.
   */
  async logout(jti: string, exp: number, user: User): Promise<void> {
    await this.tokenBlacklistService.blacklist(jti, exp);

    await this.auditLogsService.log({
      action: AuditAction.LOGOUT,
      entity: AuditEntity.AUTH,
      entityTitle: `${user.name} logged out`,
      performedBy: user,
    });
  }

  private buildResponse(user: User) {
    // Each token gets a unique ID so it can be individually invalidated on logout.
    const jti = randomUUID();

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      // The decoded exp is available after sign — derive it for cookie max-age
      jti,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  /**
   * Step 1 — request an OTP.
   * Always returns the same response whether the email exists or not.
   * This prevents attackers from enumerating registered addresses.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(dto.email);

    if (user) {
      // Invalidate any previous unused tokens for this email
      await this.passwordResetRepo
        .createQueryBuilder()
        .update(PasswordResetToken)
        .set({ usedAt: new Date() })
        .where('email = :email AND usedAt IS NULL', { email: dto.email })
        .execute();

      // Generate a cryptographically random 6-digit OTP
      const otp = randomInt(100_000, 999_999).toString();
      const tokenHash = await bcrypt.hash(otp, 10);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1_000); // 15 minutes

      const token = this.passwordResetRepo.create({
        email: dto.email,
        tokenHash,
        expiresAt,
        usedAt: null,
      });
      await this.passwordResetRepo.save(token);

      // Fire-and-forget — a failed email never blocks the response
      void this.emailService.sendPasswordResetOtp(dto.email, user.name, otp);
    }

    // Identical response either way — no information leak
    return {
      message: 'If that email is registered you will receive a reset code shortly.',
    };
  }

  /**
   * Step 2 — verify the OTP and set a new password.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    // Find the most recent valid (unused, unexpired) token for this email
    const token = await this.passwordResetRepo
      .createQueryBuilder('t')
      .where('t.email = :email', { email: dto.email })
      .andWhere('t.usedAt IS NULL')
      .andWhere('t.expiresAt > NOW()')
      .orderBy('t.createdAt', 'DESC')
      .getOne();

    // Deliberately vague error — don't reveal why it failed
    const INVALID = 'Reset code is invalid or has expired.';

    if (!token) throw new BadRequestException(INVALID);

    const isMatch = await bcrypt.compare(dto.otp, token.tokenHash);
    if (!isMatch) throw new BadRequestException(INVALID);

    // Mark the token as used before touching the password
    token.usedAt = new Date();
    await this.passwordResetRepo.save(token);

    // Update the password — reuse the same logic as changePassword
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new BadRequestException(INVALID);

    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await this.usersService.updatePasswordDirectly(user.id, hashed);

    await this.auditLogsService.log({
      action: AuditAction.PASSWORD_CHANGE,
      entity: AuditEntity.AUTH,
      entityId: user.id,
      entityTitle: `${user.name} reset their password via OTP`,
      performedBy: user,
    });

    // Security notifications — same as the manual change flow
    void this.emailService.sendPasswordChanged(user.email, user.name);

    return { message: 'Password reset successfully. You can now log in.' };
  }
}
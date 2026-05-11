import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/entities/user.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction } from '../audit-logs/enums/audit-action.enum';
import { AuditEntity } from '../audit-logs/enums/audit-entity.enum';
import { TokenBlacklistService } from '../token-blacklist/token-blacklist.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly auditLogsService: AuditLogsService,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.usersService.create(dto.name, dto.email, dto.password);
    return this.buildResponse(user);
  }

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

    await this.auditLogsService.log({
      action: AuditAction.LOGIN,
      entity: AuditEntity.AUTH,
      entityTitle: `${user.name} logged in`,
      performedBy: user,
    });

    return this.buildResponse(user);
  }

  /**
   * Invalidate the user's current token.
   * Called by the logout endpoint after the token is decoded from the cookie.
   */
  async logout(jti: string, exp: number): Promise<void> {
    await this.tokenBlacklistService.blacklist(jti, exp);
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
}
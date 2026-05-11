import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { UsersService } from '../../users/users.service';
import { TokenBlacklistService } from '../../token-blacklist/token-blacklist.service';

/**
 * Extracts the JWT from:
 * 1. The `access_token` httpOnly cookie  (admin web portal)
 * 2. The Authorization Bearer header     (mobile app / API clients)
 *
 * Cookie takes precedence — if both are present, the cookie wins.
 */
function cookieOrBearerExtractor(req: Request): string | null {
  const cookieToken = (req.cookies as Record<string, string>)?.['access_token'];
  if (cookieToken) return cookieToken;

  // Fall back to the standard Bearer header
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {
    super({
      jwtFromRequest: cookieOrBearerExtractor,
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') as string,
      passReqToCallback: false,
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    role: string;
    jti?: string;
  }) {
    try {
      // ── Token blacklist check ─────────────────────────────────────────────
      // Ensures logged-out tokens cannot be reused even before natural expiry.
      if (payload.jti) {
        const revoked = await this.tokenBlacklistService.isBlacklisted(payload.jti);
        if (revoked) {
          throw new UnauthorizedException('Token has been revoked. Please log in again.');
        }
      }

      const user = await this.usersService.findById(payload.sub);
      if (!user) throw new UnauthorizedException('Session expired. Please log in again.');
      if (!user.isActive) throw new UnauthorizedException('Account is deactivated.');

      return user;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Session expired. Please log in again.');
    }
  }
}
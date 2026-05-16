import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { TokenBlacklistService } from '../../token-blacklist/token-blacklist.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {
    super({
      // Read token from Authorization: Bearer <token> header only
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') as string,
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    role: string;
    jti?: string;
  }) {
    try {
      if (payload.jti) {
        const revoked = await this.tokenBlacklistService.isBlacklisted(payload.jti);
        if (revoked) {
          throw new UnauthorizedException('Token has been revoked. Please log in again.');
        }
      }

      const user = await this.usersService.findById(payload.sub);
      if (!user) throw new UnauthorizedException('Session expired. Please log in again.');
      if (!user.isActive) throw new UnauthorizedException('Account is deactivated.');

      if (user.scheduledPurgeAt) {
        throw new UnauthorizedException(
          'This account is pending deletion. Contact support@rentora.ug if this was a mistake.',
        );
      }

      return user;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Session expired. Please log in again.');
    }
  }
}
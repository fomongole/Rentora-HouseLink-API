import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { UserRole } from '../enums/user-role.enum';
import { IsStrongPassword } from '../../../common/decorators/is-strong-password.decorator';

export class CreateAdminDto {
  @ApiProperty({ example: 'Sarah Nakato' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'sarah@nyumbalink.com' })
  @IsEmail()
  email: string;

  @IsStrongPassword('SecurePass123')
  password: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.ADMIN })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}
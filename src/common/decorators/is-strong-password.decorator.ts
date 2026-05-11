import { applyDecorators } from '@nestjs/common';
import { IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Composite decorator for password fields.
 * Enforces: minimum 8 characters, at least one uppercase letter,
 * at least one digit.
 *
 * Use on any DTO field that accepts a user-supplied password.
 */
export function IsStrongPassword(example = 'Secure1234'): PropertyDecorator {
  return applyDecorators(
    ApiProperty({
      example,
      minLength: 8,
      description:
        'Minimum 8 characters, at least one uppercase letter and one number.',
    }),
    IsString(),
    MinLength(8, { message: 'Password must be at least 8 characters long.' }),
    Matches(/[A-Z]/, {
      message: 'Password must contain at least one uppercase letter.',
    }),
    Matches(/\d/, {
      message: 'Password must contain at least one number.',
    }),
  );
}
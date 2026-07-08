import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8, maxLength: 128, example: "Password123!" })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty({ minLength: 2, maxLength: 32, example: "팬덱스유저" })
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  nickname: string;
}

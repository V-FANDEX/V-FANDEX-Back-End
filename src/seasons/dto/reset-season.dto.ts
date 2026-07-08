import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class ResetSeasonDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  confirm: boolean;
}

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";

export class UpdateListingStatusDto {
  @ApiProperty()
  @IsBoolean()
  isListed: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isTradingSuspended?: boolean;
}

import { IsBoolean, IsOptional } from "class-validator";

export class UpdateListingStatusDto {
  @IsBoolean()
  isListed: boolean;

  @IsOptional()
  @IsBoolean()
  isTradingSuspended?: boolean;
}

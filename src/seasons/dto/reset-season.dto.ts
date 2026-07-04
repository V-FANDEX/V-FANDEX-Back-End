import { IsBoolean } from "class-validator";

export class ResetSeasonDto {
  @IsBoolean()
  confirm: boolean;
}

import { PartialType } from "@nestjs/swagger";
import { CreateAiAccountDto } from "./create-ai-account.dto";

export class UpdateAiAccountDto extends PartialType(CreateAiAccountDto) {}

import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService
  ) {}

  async register(dto: RegisterDto) {
    const initialCash = this.config.get<string>("DEFAULT_INITIAL_CASH") ?? "1000000";
    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          nickname: dto.nickname,
          role: Role.USER,
          cash: initialCash,
          initialCash,
          totalAssetValue: initialCash
        },
        select: this.safeUserSelect()
      });

      return this.withToken(user);
    } catch {
      throw new BadRequestException("Email or nickname is already in use.");
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() }
    });

    if (!user || !user.passwordHash || user.role === Role.AI || !user.isActive) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    return this.withToken({
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      role: user.role,
      cash: user.cash,
      initialCash: user.initialCash,
      totalAssetValue: user.totalAssetValue,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  }

  private async withToken<T extends { id: string }>(user: T) {
    const accessToken = await this.jwtService.signAsync({ sub: user.id });
    return { accessToken, user };
  }

  private safeUserSelect() {
    return {
      id: true,
      email: true,
      nickname: true,
      role: true,
      cash: true,
      initialCash: true,
      totalAssetValue: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    };
  }
}

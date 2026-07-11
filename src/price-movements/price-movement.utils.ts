import { Prisma } from "@prisma/client";
import { money } from "../common/utils/decimal";

export interface PriceMovementState {
  currentPrice: Prisma.Decimal;
  targetPrice: Prisma.Decimal | null;
  movementStartPrice: Prisma.Decimal | null;
  movementStartedAt: Date | null;
  movementEndsAt: Date | null;
}

export function resolveMovementPrice(stock: PriceMovementState, at = new Date()) {
  if (
    !stock.targetPrice ||
    !stock.movementStartPrice ||
    !stock.movementStartedAt ||
    !stock.movementEndsAt
  ) {
    return money(stock.currentPrice);
  }

  const startedAt = stock.movementStartedAt.getTime();
  const endsAt = stock.movementEndsAt.getTime();
  const now = at.getTime();
  if (now <= startedAt || endsAt <= startedAt) {
    return money(stock.movementStartPrice);
  }
  if (now >= endsAt) {
    return money(stock.targetPrice);
  }

  const progress = (now - startedAt) / (endsAt - startedAt);
  const easedProgress = progress * progress * (3 - 2 * progress);
  const price = stock.movementStartPrice.plus(
    stock.targetPrice.minus(stock.movementStartPrice).mul(easedProgress),
  );
  return money(Prisma.Decimal.max(price, 1));
}

export function priceMovementProgress(stock: PriceMovementState, at = new Date()) {
  if (!stock.targetPrice || !stock.movementStartedAt || !stock.movementEndsAt) {
    return 0;
  }

  const duration = stock.movementEndsAt.getTime() - stock.movementStartedAt.getTime();
  if (duration <= 0) {
    return 1;
  }

  return Math.min(Math.max((at.getTime() - stock.movementStartedAt.getTime()) / duration, 0), 1);
}

export function isPriceMovementActive(stock: PriceMovementState, at = new Date()) {
  return Boolean(stock.targetPrice && stock.movementEndsAt && stock.movementEndsAt > at);
}

export function withLivePrice<T extends PriceMovementState>(stock: T, at = new Date()) {
  return {
    ...stock,
    currentPrice: resolveMovementPrice(stock, at),
    isPriceMoving: isPriceMovementActive(stock, at),
    priceMovementProgress: priceMovementProgress(stock, at),
    priceAsOf: at,
  };
}

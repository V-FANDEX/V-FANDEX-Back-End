import { Prisma } from "@prisma/client";

export type DecimalInput = Prisma.Decimal | number | string;

export const toDecimal = (value: DecimalInput): Prisma.Decimal => new Prisma.Decimal(value);

export const money = (value: DecimalInput): Prisma.Decimal => toDecimal(value).toDecimalPlaces(4);

export const rate = (value: DecimalInput): Prisma.Decimal => toDecimal(value).toDecimalPlaces(6);

export const zero = (): Prisma.Decimal => new Prisma.Decimal(0);

export const isPositive = (value: DecimalInput): boolean => toDecimal(value).greaterThan(0);

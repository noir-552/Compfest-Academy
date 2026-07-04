import { prisma } from '../lib/prisma';
import { ApiError } from '../lib/api-error';

export interface AddressInput {
  label: string;
  recipientName: string;
  phone: string;
  fullAddress: string;
  isDefault?: boolean;
}

export interface AddressUpdateInput {
  label?: string;
  recipientName?: string;
  phone?: string;
  fullAddress?: string;
  isDefault?: boolean;
}

export interface PublicAddress {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  fullAddress: string;
  isDefault: boolean;
  createdAt: Date;
}

interface AddressRecord {
  id: string;
  buyerUserId: string;
  label: string;
  recipientName: string;
  phone: string;
  fullAddress: string;
  isDefault: boolean;
  createdAt: Date;
}

function toPublicAddress(address: AddressRecord): PublicAddress {
  return {
    id: address.id,
    label: address.label,
    recipientName: address.recipientName,
    phone: address.phone,
    fullAddress: address.fullAddress,
    isDefault: address.isDefault,
    createdAt: address.createdAt,
  };
}

export async function listOwnAddresses(buyerUserId: string): Promise<PublicAddress[]> {
  const addresses = await prisma.address.findMany({
    where: { buyerUserId },
    orderBy: { createdAt: 'desc' },
  });
  return addresses.map(toPublicAddress);
}

export async function createAddress(buyerUserId: string, input: AddressInput): Promise<PublicAddress> {
  const isDefault = input.isDefault ?? false;

  if (isDefault) {
    const [, address] = await prisma.$transaction([
      prisma.address.updateMany({ where: { buyerUserId, isDefault: true }, data: { isDefault: false } }),
      prisma.address.create({
        data: {
          buyerUserId,
          label: input.label,
          recipientName: input.recipientName,
          phone: input.phone,
          fullAddress: input.fullAddress,
          isDefault: true,
        },
      }),
    ]);
    return toPublicAddress(address);
  }

  const address = await prisma.address.create({
    data: {
      buyerUserId,
      label: input.label,
      recipientName: input.recipientName,
      phone: input.phone,
      fullAddress: input.fullAddress,
      isDefault: false,
    },
  });
  return toPublicAddress(address);
}

async function getOwnedAddressOrThrow(buyerUserId: string, addressId: string): Promise<AddressRecord> {
  const address = await prisma.address.findUnique({ where: { id: addressId } });
  if (!address || address.buyerUserId !== buyerUserId) {
    throw new ApiError(404, 'ADDRESS_NOT_FOUND', 'Address not found');
  }
  return address;
}

export async function updateAddress(
  buyerUserId: string,
  addressId: string,
  input: AddressUpdateInput,
): Promise<PublicAddress> {
  await getOwnedAddressOrThrow(buyerUserId, addressId);

  const data = {
    ...(input.label !== undefined && { label: input.label }),
    ...(input.recipientName !== undefined && { recipientName: input.recipientName }),
    ...(input.phone !== undefined && { phone: input.phone }),
    ...(input.fullAddress !== undefined && { fullAddress: input.fullAddress }),
  };

  if (input.isDefault === true) {
    const [, address] = await prisma.$transaction([
      prisma.address.updateMany({
        where: { buyerUserId, isDefault: true, id: { not: addressId } },
        data: { isDefault: false },
      }),
      prisma.address.update({ where: { id: addressId }, data: { ...data, isDefault: true } }),
    ]);
    return toPublicAddress(address);
  }

  const address = await prisma.address.update({
    where: { id: addressId },
    data: { ...data, ...(input.isDefault === false && { isDefault: false }) },
  });
  return toPublicAddress(address);
}

export async function deleteAddress(buyerUserId: string, addressId: string): Promise<void> {
  await getOwnedAddressOrThrow(buyerUserId, addressId);
  await prisma.address.delete({ where: { id: addressId } });
}

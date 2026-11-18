import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/action-result";
import type { StaffContext } from "@/modules/access-control/context";
import type { ClientInput } from "@/modules/clients/schemas";

const DUPLICATE_NAME = "A client with this name already exists.";

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function clientData(input: ClientInput) {
  return {
    name: input.name.trim(),
    contactName: input.contactName ?? null,
    contactEmail: input.contactEmail ?? null,
    contactPhone: input.contactPhone ?? null,
    website: input.website ?? null,
    notes: input.notes ?? null,
  };
}

/** Friendly message before the insert; the unique index (lower(btrim(name))) is the real guard. */
async function assertNameAvailable(name: string, exceptId?: string) {
  const same = await prisma.client.findFirst({
    where: { name: { equals: name.trim(), mode: "insensitive" }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  });
  if (same) throw new AppError(DUPLICATE_NAME);
}

async function loadClient(clientId: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true } });
  if (!client) throw new AppError("Client not found.");
  return client;
}

export async function createClient(ctx: StaffContext, input: ClientInput) {
  await assertNameAvailable(input.name);
  try {
    return await prisma.client.create({ data: { ...clientData(input), createdById: ctx.user.id }, select: { id: true, name: true } });
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError(DUPLICATE_NAME);
    throw error;
  }
}

export async function updateClient(clientId: string, input: ClientInput) {
  await loadClient(clientId);
  await assertNameAvailable(input.name, clientId);
  try {
    return await prisma.client.update({ where: { id: clientId }, data: clientData(input), select: { id: true, name: true } });
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError(DUPLICATE_NAME);
    throw error;
  }
}

/** Inactive clients can't be picked for new jobs; jobs already linked to them keep the link. */
export async function setClientActive(clientId: string, active: boolean) {
  await loadClient(clientId);
  return prisma.client.update({ where: { id: clientId }, data: { isActive: active }, select: { id: true, name: true } });
}

/** Only a client with no jobs can be deleted (the foreign key also refuses it). */
export async function deleteClient(clientId: string) {
  const client = await loadClient(clientId);
  const jobs = await prisma.job.count({ where: { clientId } });
  if (jobs > 0) {
    throw new AppError(`${client.name} has ${jobs} job${jobs === 1 ? "" : "s"} and can't be deleted. Deactivate the client instead.`);
  }
  try {
    await prisma.client.delete({ where: { id: clientId } });
  } catch (error) {
    // A job was linked between the count and the delete (ON DELETE RESTRICT).
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2003" || error.code === "P2014")) {
      throw new AppError(`${client.name} has jobs and can't be deleted. Deactivate the client instead.`);
    }
    throw error;
  }
  return client;
}

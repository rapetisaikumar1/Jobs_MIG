import "server-only";
import { unstable_rethrow } from "next/navigation";
import { Prisma } from "@prisma/client";
import { AppError, fail, type ActionResult } from "@/lib/action-result";

/**
 * Runs server-action logic and converts expected failures into an ActionResult.
 * Unexpected errors are logged and reported generically (no internals leak to the client).
 */
export async function runAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AppError) return fail(error.message);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("This record conflicts with an existing one (duplicate value).");
    }
    console.error("[action] unexpected error", error);
    return fail("Something went wrong. Please try again.");
  }
}

import { connection } from "next/server";
import { serviceStatus } from "@/server/status";

/** Which optional services are switched on (no secrets, just booleans). */
export async function GET() {
  // Read the environment at request time, not at build time.
  await connection();
  return Response.json(serviceStatus(), { headers: { "cache-control": "no-store" } });
}

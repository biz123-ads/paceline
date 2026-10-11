import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Runs the real migrations on Postgres (PGlite, in memory) with a stand-in
 * for Supabase's auth schema and roles, then checks Row Level Security and
 * the credit functions as a signed-in user would hit them.
 */

const MIGRATIONS = join(__dirname, "..", "migrations");

const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";
const ALICE_PROJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/** What Supabase provides before any migration runs. */
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

let db: PGlite;

/** Runs `sql` as a signed-in user (or as the server with service_role). */
async function as<T = Record<string, unknown>>(
  who: string | "service_role",
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  await db.exec("reset role; reset request.jwt.claim.sub;");
  if (who === "service_role") {
    await db.exec("set role service_role");
  } else {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [who]);
    await db.exec("set role authenticated");
  }
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role; reset request.jwt.claim.sub;");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of readdirSync(MIGRATIONS).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  }
  await db.exec(`insert into auth.users (id, email) values ('${ALICE}', 'a@example.com'), ('${BOB}', 'b@example.com')`);
  await as(
    ALICE,
    `insert into public.projects (id, name, kind, stage, currency) values ($1, 'Alice SaaS', 'saas', 'launched', 'EUR')`,
    [ALICE_PROJECT],
  );
  await as(
    ALICE,
    `insert into public.snapshots (id, project_id, period, mrr, paying_customers) values (gen_random_uuid(), $1, '2026-09', 120000, 60)`,
    [ALICE_PROJECT],
  );
});

describe("row level security", () => {
  it("fills user_id from the session", async () => {
    const [row] = await as<{ user_id: string }>(ALICE, "select user_id from public.projects");
    expect(row.user_id).toBe(ALICE);
  });

  it("hides other people's rows", async () => {
    expect(await as(BOB, "select * from public.projects")).toEqual([]);
    expect(await as(BOB, "select * from public.snapshots")).toEqual([]);
    const updated = await as(BOB, "update public.projects set name = 'mine now' returning id");
    expect(updated).toEqual([]);
  });

  it("refuses rows on someone else's project", async () => {
    await expect(
      as(
        BOB,
        `insert into public.snapshots (id, project_id, period, mrr, paying_customers) values (gen_random_uuid(), $1, '2026-08', 1, 1)`,
        [ALICE_PROJECT],
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("refuses a user_id that is not yours", async () => {
    await expect(
      as(
        BOB,
        `insert into public.projects (id, user_id, name, kind, stage, currency) values (gen_random_uuid(), $1, 'x', 'saas', 'idea', 'EUR')`,
        [ALICE],
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("keeps one row per project and month", async () => {
    await expect(
      as(
        ALICE,
        `insert into public.snapshots (id, project_id, period, mrr, paying_customers) values (gen_random_uuid(), $1, '2026-09', 1, 1)`,
        [ALICE_PROJECT],
      ),
    ).rejects.toThrow(/duplicate key/);
  });

  it("deletes a project's months and goal with it", async () => {
    const id = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    await as(ALICE, `insert into public.projects (id, name, kind, stage, currency) values ($1, 'Temp', 'app', 'idea', 'USD')`, [id]);
    await as(
      ALICE,
      `insert into public.goals (id, project_id, target_mrr, deadline, baseline_period, baseline_mrr) values (gen_random_uuid(), $1, 100000, '2027-09', '2026-09', 0)`,
      [id],
    );
    await as(ALICE, "delete from public.projects where id = $1", [id]);
    expect(await as(ALICE, "select * from public.goals where project_id = $1", [id])).toEqual([]);
  });
});

describe("credits", () => {
  const balance = async (who: string) =>
    (await as<{ b: number }>(who, "select public.credit_balance() as b"))[0].b;

  it("starts every account with a bonus", async () => {
    expect(await balance(ALICE)).toBe(10);
    expect(await balance(BOB)).toBe(10);
  });

  it("lets users read their ledger but never write it", async () => {
    expect(await as(BOB, "select delta, reason from public.credit_ledger")).toEqual([
      { delta: 10, reason: "signup_bonus" },
    ]);
    await expect(
      as(BOB, `insert into public.credit_ledger (user_id, delta, reason) values ($1, 1000, 'adjustment')`, [BOB]),
    ).rejects.toThrow(/row-level security/);
  });

  it("only the server can reserve or refund", async () => {
    await expect(as(BOB, `select public.reserve_credits($1, 1, 'r0')`, [BOB])).rejects.toThrow(/permission denied/);
    await expect(as(BOB, `select public.refund_credits('r0')`)).rejects.toThrow(/permission denied/);
  });

  it("reserves, refuses past zero, and refunds once", async () => {
    await as("service_role", `select public.reserve_credits($1, 4, 'req-1')`, [ALICE]);
    expect(await balance(ALICE)).toBe(6);
    await expect(
      as("service_role", `select public.reserve_credits($1, 7, 'req-2')`, [ALICE]),
    ).rejects.toThrow(/insufficient_credits/);
    await as("service_role", `select public.refund_credits('req-1')`);
    await as("service_role", `select public.refund_credits('req-1')`);
    expect(await balance(ALICE)).toBe(10);
  });

  it("records a purchase once, however often the webhook fires", async () => {
    const insert = `insert into public.credit_ledger (user_id, delta, reason, reference) values ($1, 100, 'purchase', 'cs_test_1') on conflict (reason, reference) do nothing`;
    await as("service_role", insert, [BOB]);
    await as("service_role", insert, [BOB]);
    expect(await balance(BOB)).toBe(110);
  });
});

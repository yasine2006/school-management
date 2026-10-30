import { Prisma } from "@prisma/client";
import { createPrisma } from "../src/lib/prisma";

const db = createPrisma();

const DEL = {
  a: "NO ACTION",
  r: "RESTRICT",
  c: "CASCADE",
  n: "SET NULL",
  d: "SET DEFAULT",
} as const;

type Fk = {
  name: string;
  child_table: string;
  parent_table: string;
  child_cols: string;
  parent_cols: string;
  delete_action: keyof typeof DEL;
};

async function rowCounts() {
  const tables = await db.$queryRaw<{ table_name: string }[]>(Prisma.sql`
    SELECT c.relname::text AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r' AND n.nspname = 'public' AND c.relname NOT LIKE '\\_prisma%'
    ORDER BY c.relname
  `);
  const out: { table: string; rows: number }[] = [];
  for (const { table_name } of tables) {
    const [r] = await db.$queryRaw<{ n: number }[]>(
      Prisma.sql`SELECT COUNT(*)::int AS n FROM ${Prisma.raw(`"${table_name}"`)}`,
    );
    out.push({ table: table_name, rows: r.n });
  }
  return out;
}

async function foreignKeys() {
  return db.$queryRaw<Fk[]>(Prisma.sql`
    SELECT con.conname::text AS name,
           child.relname::text  AS child_table,
           parent.relname::text AS parent_table,
           (SELECT string_agg(att.attname, ',' ORDER BY k.ord)
              FROM unnest(con.conkey) WITH ORDINALITY k(attnum, ord)
              JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k.attnum) AS child_cols,
           (SELECT string_agg(att.attname, ',' ORDER BY k.ord)
              FROM unnest(con.confkey) WITH ORDINALITY k(attnum, ord)
              JOIN pg_attribute att ON att.attrelid = con.confrelid AND att.attnum = k.attnum) AS parent_cols,
           con.confdeltype::text AS delete_action
    FROM pg_constraint con
    JOIN pg_class child  ON child.oid = con.conrelid
    JOIN pg_class parent ON parent.oid = con.confrelid
    WHERE con.contype = 'f' AND con.connamespace = 'public'::regnamespace
    ORDER BY child.relname, con.conname
  `);
}

async function orphanCount(fk: Fk) {
  const childCols = fk.child_cols.split(",");
  const parentCols = fk.parent_cols.split(",");
  const join = childCols
    .map((c, i) => Prisma.sql`p.${Prisma.raw(`"${parentCols[i]}"`)} = c.${Prisma.raw(`"${c}"`)}`)
    .reduce((a, b) => Prisma.sql`${a} AND ${b}`);
  const notNull = childCols
    .map((c) => Prisma.sql`c.${Prisma.raw(`"${c}"`)} IS NOT NULL`)
    .reduce((a, b) => Prisma.sql`${a} AND ${b}`);
  const [r] = await db.$queryRaw<{ n: number }[]>(Prisma.sql`
    SELECT COUNT(*)::int AS n
    FROM ${Prisma.raw(`"${fk.child_table}"`)} c
    LEFT JOIN ${Prisma.raw(`"${fk.parent_table}"`)} p ON ${join}
    WHERE ${notNull} AND p.${Prisma.raw(`"${parentCols[0]}"`)} IS NULL
  `);
  return r.n;
}

async function uniqueConstraints() {
  return db.$queryRaw<{ name: string; table_name: string; cols: string; is_primary: boolean }[]>(Prisma.sql`
    SELECT i.relname::text AS name, t.relname::text AS table_name, ix.indisprimary AS is_primary,
           (SELECT string_agg(a.attname, ',' ORDER BY k.ord)
              FROM unnest(ix.indkey) WITH ORDINALITY k(attnum, ord)
              JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum) AS cols
    FROM pg_index ix
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND ix.indisunique
      AND t.relname NOT LIKE '\\_prisma%'
    ORDER BY t.relname, ix.indisprimary DESC, i.relname
  `);
}

async function main() {
  let failures = 0;

  console.log("\n=== Row counts ===");
  for (const { table, rows } of await rowCounts()) console.log(`  ${table.padEnd(22)} ${rows}`);

  console.log("\n=== Foreign keys (relations) ===");
  const fks = await foreignKeys();
  for (const fk of fks) {
    const orphans = await orphanCount(fk);
    if (orphans > 0) failures++;
    const rule = DEL[fk.delete_action] ?? fk.delete_action;
    const status = orphans === 0 ? "OK" : `ORPHANS=${orphans}`;
    console.log(
      `  ${status.padEnd(12)} ${fk.child_table}.${fk.child_cols} -> ${fk.parent_table}.${fk.parent_cols}  [onDelete ${rule}]`,
    );
  }

  console.log("\n=== Unique / primary keys ===");
  for (const u of await uniqueConstraints()) {
    const kind = u.is_primary ? "PK " : "UQ ";
    console.log(`  ${kind} ${u.table_name}(${u.cols})`);
  }

  console.log(`\n=== Result: ${fks.length} foreign keys, ${failures} integrity violations ===`);
  await db.$disconnect();
  if (failures > 0) process.exit(1);
}

main();

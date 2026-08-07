import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import snowflake from "snowflake-sdk";
import { parse as parseToml } from "smol-toml";

export type SnowflakeConn = {
  name: string;
  account: string;
  username: string;
  password?: string;
  authenticator?: string;
  warehouse?: string;
  role?: string;
  database?: string;
  schema?: string;
};

/**
 * Load a named connection from ~/.snowflake/connections.toml.
 * Never logs password/PAT.
 */
export async function loadSnowflakeConnection(
  name = process.env.CORTEX_CONNECTION || "NPSZJKJ-QP25178",
): Promise<SnowflakeConn> {
  const file = path.join(os.homedir(), ".snowflake", "connections.toml");
  const raw = await readFile(file, "utf8");
  const doc = parseToml(raw) as Record<string, unknown>;
  const section = doc[name];
  if (!section || typeof section !== "object") {
    throw new Error(`Connection "${name}" not found in ${file}`);
  }
  const s = section as Record<string, unknown>;
  const account = String(s.account ?? "");
  const username = String(s.user ?? s.username ?? "");
  if (!account || !username) {
    throw new Error(`Connection "${name}" missing account/user`);
  }
  return {
    name,
    account,
    username,
    password: s.password != null ? String(s.password) : undefined,
    authenticator: s.authenticator != null ? String(s.authenticator) : undefined,
    warehouse: s.warehouse != null ? String(s.warehouse) : undefined,
    role: s.role != null ? String(s.role) : undefined,
    database: s.database != null ? String(s.database) : undefined,
    schema: s.schema != null ? String(s.schema) : undefined,
  };
}

export async function executeSql<T extends Record<string, unknown> = Record<string, unknown>>(
  sqlText: string,
  connectionName?: string,
): Promise<T[]> {
  const cfg = await loadSnowflakeConnection(connectionName);
  snowflake.configure({ logLevel: "OFF" });

  const isPat =
    !!cfg.password &&
    (cfg.password.startsWith("eyJ") || !cfg.authenticator);

  const connection = snowflake.createConnection(
    isPat && cfg.password
      ? {
          account: cfg.account,
          username: cfg.username,
          authenticator: "PROGRAMMATIC_ACCESS_TOKEN",
          token: cfg.password,
          warehouse: cfg.warehouse,
          role: cfg.role,
          database: cfg.database,
          schema: cfg.schema,
        }
      : {
          account: cfg.account,
          username: cfg.username,
          password: cfg.password,
          authenticator: cfg.authenticator,
          warehouse: cfg.warehouse,
          role: cfg.role,
          database: cfg.database,
          schema: cfg.schema,
        },
  );

  await new Promise<void>((resolve, reject) => {
    connection.connect((err) => (err ? reject(err) : resolve()));
  });

  try {
    const rows = await new Promise<T[]>((resolve, reject) => {
      connection.execute({
        sqlText,
        complete: (err, _stmt, resultRows) => {
          if (err) reject(err);
          else resolve((resultRows as T[]) ?? []);
        },
      });
    });
    return rows;
  } finally {
    await new Promise<void>((resolve) => {
      connection.destroy(() => resolve());
    });
  }
}

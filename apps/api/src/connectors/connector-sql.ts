/** Allow read-only SELECT queries for connector sync. */
export function assertReadOnlySql(sql: string): void {
  const normalized = sql.trim().replace(/\s+/g, " ");
  if (!/^select\b/i.test(normalized)) {
    throw new Error("Only SELECT queries are allowed");
  }
  const forbidden = /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke)\b/i;
  if (forbidden.test(normalized)) {
    throw new Error("Query contains forbidden keywords");
  }
}

/**
 * DatabaseProvider — adapter architecture for generated business data.
 * NEVER connects generated apps to JIY.APP production database.
 */

export type DatabaseMode = "LOCAL" | "DEMO" | "ISOLATED_SCHEMA" | "SUPABASE_BRANCH";

export interface DatabaseProvider {
  readonly mode: DatabaseMode;
  readonly label: string;
  connect(): Promise<void>;
  isProductionConnected(): boolean;
}

export class DemoDatabaseProvider implements DatabaseProvider {
  readonly mode = "DEMO" as const;
  readonly label = "LOCAL / DEMO / NOT PERSISTED";
  private connected = false;

  async connect() {
    this.connected = true;
  }

  isProductionConnected() {
    return false;
  }
}

export function createBusinessDatabaseProvider(): DatabaseProvider {
  // When production Supabase isolation is available, swap to IsolatedSchemaProvider
  return new DemoDatabaseProvider();
}

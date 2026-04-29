declare module "embedded-postgres" {
  import type { Client } from "pg";

  type EmbeddedPostgresOptions = {
    databaseDir?: string;
    port?: number;
    user?: string;
    password?: string;
    authMethod?: "scram-sha-256" | "password" | "md5";
    persistent?: boolean;
    initdbFlags?: string[];
    postgresFlags?: string[];
    createPostgresUser?: boolean;
    onLog?: (message: unknown) => void;
    onError?: (message: unknown) => void;
  };

  export default class EmbeddedPostgres {
    constructor(options?: EmbeddedPostgresOptions);
    initialise(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    createDatabase(name: string): Promise<void>;
    dropDatabase(name: string): Promise<void>;
    getPgClient(database?: string, host?: string): Client;
  }
}

import { Pool, PoolClient, QueryResult } from "pg";

export class DbConnection {
    private static pool: Pool | undefined;
    private static transactionClient: PoolClient | undefined;

    private static ensurePool(): Pool {
        if (!DbConnection.pool) {
            throw new Error("Database connection has not been initialized");
        }
        return DbConnection.pool;
    }

    public static async connect() {
        if (!DbConnection.pool) {
            const pool = new Pool({
                user: process.env.DB_USER,
                host: process.env.DB_HOST,
                database: process.env.DB_NAME,
                password: process.env.DB_PASSWORD,
                port: Number(process.env.DB_PORT),
            });

            pool.on("error", (error) => {
                console.error("Unexpected database error", error);
            });

            DbConnection.pool = pool;
        }

        await DbConnection.pool.query("SELECT 1");
    }

    public static async disconnect() {
        if (DbConnection.transactionClient) {
            DbConnection.transactionClient.release();
            DbConnection.transactionClient = undefined;
        }

        if (DbConnection.pool) {
            await DbConnection.pool.end();
            DbConnection.pool = undefined;
        }
    }

    public static async open() {
        if (!DbConnection.transactionClient) {
            DbConnection.transactionClient = await DbConnection.ensurePool().connect();
        }
        await DbConnection.transactionClient.query("BEGIN");
    }

    public static async startTransaction() {
        await DbConnection.open();
    }

    public static async commit() {
        if (!DbConnection.transactionClient) {
            throw new Error("Database connection has not been initialized");
        }
        await DbConnection.transactionClient.query("COMMIT");
        DbConnection.transactionClient.release();
        DbConnection.transactionClient = undefined;
    }

    public static async rollback() {
        if (!DbConnection.transactionClient) {
            throw new Error("Database connection has not been initialized");
        }
        await DbConnection.transactionClient.query("ROLLBACK");
        DbConnection.transactionClient.release();
        DbConnection.transactionClient = undefined;
    }

    public static async query(query: {
        sql: string;
        params: any[];
    }): Promise<any[]> {
        const pool = DbConnection.ensurePool();

        const client: { query: (sql: string, params: any[]) => Promise<QueryResult> } =
            DbConnection.transactionClient ?? pool;

        const result = await client.query(query.sql, query.params);
        return result.rows;
    }
}

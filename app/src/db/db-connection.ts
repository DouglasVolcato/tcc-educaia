import { Pool, PoolClient } from "pg";

export class DbConnection {
    private static connection: PoolClient;

    public static async connect() {
        const databasePool = new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: Number(process.env.DB_PORT),
        });
        if (!DbConnection.connection) {
            DbConnection.connection = await databasePool.connect();
        }
    }
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbConnection = void 0;
const pg_1 = require("pg");
class DbConnection {
    static async connect() {
        const databasePool = new pg_1.Pool({
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
exports.DbConnection = DbConnection;

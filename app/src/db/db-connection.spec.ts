import { DbConnection } from "./db-connection";
import { FakeData } from "../tests/fake-data";
import { Pool, PoolClient } from "pg";

const mockPoolClient = (): jest.Mocked<PoolClient> => ({
    query: jest.fn(),
    release: jest.fn(),
} as any);

const mockPoolQuery = jest.fn();
const mockPoolConnect = jest.fn(mockPoolClient);
const mockPoolEnd = jest.fn();
const mockPoolOn = jest.fn();

jest.mock("pg", () => ({
    Pool: jest.fn(() => ({
        query: mockPoolQuery,
        connect: mockPoolConnect,
        end: mockPoolEnd,
        on: mockPoolOn,
    })),
}));

const mockEnvVars = () => {
    const user = FakeData.word();
    const host = FakeData.url();
    const database = FakeData.phrase();
    const password = FakeData.password();
    const port = FakeData.numberInteger();

    process.env.DB_USER = user;
    process.env.DB_HOST = host;
    process.env.DB_NAME = database;
    process.env.DB_PASSWORD = password;
    process.env.DB_PORT = String(port);

    return {
        user,
        host,
        database,
        password,
        port,
    }
}

describe("DbConnection", () => {
    beforeEach(() => {
        (DbConnection as any).pool = undefined;
        (DbConnection as any).transactionClient = undefined;
        jest.clearAllMocks();
    });

    describe("Connect", () => {
        test("Connect should create a new pool with right values", async () => {
            const envVars = mockEnvVars()
            const sut = DbConnection
            mockPoolQuery.mockResolvedValueOnce({ rows: [] } as any)
            await sut.connect()
            expect(Pool).toHaveBeenCalledTimes(1)
            expect(Pool).toHaveBeenCalledWith(envVars)
        })

        test("Connect should ping the database", async () => {
            mockPoolQuery.mockResolvedValueOnce({ rows: [] } as any)
            await DbConnection.connect()
            expect(mockPoolQuery).toHaveBeenCalledTimes(1)
            expect(mockPoolQuery).toHaveBeenCalledWith("SELECT 1")
        })

        test("Should not create a new pool if one already exists", async () => {
            mockPoolQuery.mockResolvedValue({ rows: [] } as any)
            await DbConnection.connect()
            await DbConnection.connect()
            expect(Pool).toHaveBeenCalledTimes(1)
        })
    })

    describe("Disconnect", () => {
        test("Should call transaction client release and pool end", async () => {
            mockPoolQuery.mockResolvedValue({ rows: [] } as any)
            const releaseSpy = jest.fn().mockResolvedValue(undefined);
            (DbConnection as any).transactionClient = {
                release: releaseSpy,
            } as unknown as PoolClient;
            (DbConnection as any).pool = {
                end: mockPoolEnd,
            } as unknown as Pool;
            await DbConnection.disconnect();
            expect(releaseSpy).toHaveBeenCalledTimes(1);
            expect(mockPoolEnd).toHaveBeenCalledTimes(1);
        })

        test("Should throw if pool end throws", async () => {
            const error = new Error(FakeData.phrase());
            mockPoolEnd.mockRejectedValueOnce(error);
            (DbConnection as any).pool = { end: mockPoolEnd } as unknown as Pool;
            await expect(DbConnection.disconnect()).rejects.toThrow(error);
        })
    })

    describe("StartTransaction", () => {
        test("Should call transaction client query with begin", async () => {
            mockPoolQuery.mockResolvedValue({ rows: [] } as any)
            const querySpy = jest.fn().mockResolvedValue(undefined);
            (DbConnection as any).pool = {
                connect: jest.fn().mockResolvedValue({ query: querySpy }),
            } as unknown as Pool;
            await DbConnection.startTransaction();
            expect(querySpy).toHaveBeenCalledTimes(1);
            expect(querySpy).toHaveBeenCalledWith("BEGIN");
        })

        test("Should throw if pool was not initialized", async () => {
            await expect(DbConnection.startTransaction()).rejects.toThrow();
        })
    })

    describe("Commit", () => {
        test("Should call transaction query with commit and release", async () => {
            const querySpy = jest.fn().mockResolvedValue(undefined);
            const releaseSpy = jest.fn().mockResolvedValue(undefined);
            (DbConnection as any).transactionClient = {
                query: querySpy,
                release: releaseSpy,
            } as unknown as PoolClient;
            await DbConnection.commit();
            expect(querySpy).toHaveBeenCalledTimes(1);
            expect(querySpy).toHaveBeenCalledWith("COMMIT");
            expect(releaseSpy).toHaveBeenCalledTimes(1);
            expect((DbConnection as any).transactionClient).toBeUndefined();
        })

        test("Should throw if transaction was not started", async () => {
            await expect(DbConnection.commit()).rejects.toThrow();
        })
    })

    describe("Rollback", () => {
        test("Should call transaction query with rollback and release", async () => {
            const querySpy = jest.fn().mockResolvedValue(undefined);
            const releaseSpy = jest.fn().mockResolvedValue(undefined);
            (DbConnection as any).transactionClient = {
                query: querySpy,
                release: releaseSpy,
            } as unknown as PoolClient;
            await DbConnection.rollback();
            expect(querySpy).toHaveBeenCalledTimes(1);
            expect(querySpy).toHaveBeenCalledWith("ROLLBACK");
            expect(releaseSpy).toHaveBeenCalledTimes(1);
            expect((DbConnection as any).transactionClient).toBeUndefined();
        })

        test("Should throw if transaction was not started", async () => {
            await expect(DbConnection.rollback()).rejects.toThrow();
        })
    })

    describe("Query", () => {
        test("Should call pool query with received params", async () => {
            const querySpy = jest.fn().mockResolvedValue({ rows: [] });
            (DbConnection as any).pool = {
                query: querySpy,
            } as unknown as Pool;
            const queryParams = {
                sql: FakeData.phrase(),
                params: [FakeData.numberInteger(), FakeData.word()],
            };
            await DbConnection.query(queryParams);
            expect(querySpy).toHaveBeenCalledTimes(1);
            expect(querySpy).toHaveBeenCalledWith(queryParams.sql, queryParams.params);
        })

        test("Should call transaction client query when inside a transaction", async () => {
            const poolQuerySpy = jest.fn().mockResolvedValue({ rows: [] });
            const transactionQuerySpy = jest.fn().mockResolvedValue({ rows: [] });
            (DbConnection as any).pool = {
                query: poolQuerySpy,
            } as unknown as Pool;
            (DbConnection as any).transactionClient = {
                query: transactionQuerySpy,
            } as unknown as PoolClient;
            const queryParams = {
                sql: FakeData.phrase(),
                params: [FakeData.word()],
            };
            await DbConnection.query(queryParams);
            expect(poolQuerySpy).not.toHaveBeenCalled();
            expect(transactionQuerySpy).toHaveBeenCalledWith(queryParams.sql, queryParams.params);
        })

        test("Should throw if pool is not initialized", async () => {
            await expect(
                DbConnection.query({
                    sql: FakeData.phrase(),
                    params: [FakeData.word()],
                })
            ).rejects.toThrow();
        })

        test("Should return query rows", async () => {
            const rows = [
                { id: FakeData.uuid() },
                { id: FakeData.uuid() },
            ];
            const querySpy = jest.fn().mockResolvedValue({ rows });
            (DbConnection as any).pool = {
                query: querySpy,
            } as unknown as Pool;
            const result = await DbConnection.query({
                sql: FakeData.phrase(),
                params: [FakeData.word()],
            });
            expect(result).toEqual(rows);
        })
    })
})

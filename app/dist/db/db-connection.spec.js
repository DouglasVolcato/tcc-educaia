"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_connection_1 = require("./db-connection");
const fake_data_1 = require("../tests/fake-data");
const pg_1 = require("pg");
const mockPoolClient = () => {
    return {};
};
const mockConnect = jest.fn(mockPoolClient);
jest.mock("pg", () => ({
    Pool: jest.fn(() => ({
        connect: mockConnect
    }))
}));
const mockEnvVars = () => {
    const user = fake_data_1.FakeData.word();
    const host = fake_data_1.FakeData.url();
    const database = fake_data_1.FakeData.phrase();
    const password = fake_data_1.FakeData.password();
    const port = fake_data_1.FakeData.numberInteger();
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
    };
};
describe("DbConnection", () => {
    beforeEach(() => {
        db_connection_1.DbConnection.connection = undefined;
        jest.clearAllMocks();
    });
    test("Connect should create a new pool with right values", async () => {
        const envVars = mockEnvVars();
        const sut = db_connection_1.DbConnection;
        await sut.connect();
        expect(pg_1.Pool).toHaveBeenCalledTimes(1);
        expect(pg_1.Pool).toHaveBeenCalledWith(envVars);
    });
    test("Connect should connect to database", async () => {
        const sut = db_connection_1.DbConnection;
        await sut.connect();
        expect(mockConnect).toHaveBeenCalledTimes(1);
        expect(mockConnect).toHaveBeenCalledWith();
    });
    test("Should throw if connection throws", async () => {
        const sut = db_connection_1.DbConnection;
        mockConnect.mockImplementationOnce(() => {
            throw new Error(fake_data_1.FakeData.phrase());
        });
        expect(async () => await sut.connect()).rejects.toThrow();
    });
    test("Should save the new connection", async () => {
        const sut = db_connection_1.DbConnection;
        await sut.connect();
        expect(sut.connection).toEqual(mockPoolClient());
    });
    test("Should not create a new connection is a connection already existed", async () => {
        const newConnection = fake_data_1.FakeData.uuid();
        const sut = db_connection_1.DbConnection;
        expect(sut.connection).toBeUndefined();
        mockConnect.mockImplementationOnce(() => newConnection);
        await sut.connect();
        expect(sut.connection).toBe(newConnection);
        mockConnect.mockImplementationOnce(() => fake_data_1.FakeData.uuid());
        await sut.connect();
        expect(sut.connection).toBe(newConnection);
    });
});

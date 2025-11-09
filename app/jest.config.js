/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
    preset: "ts-jest/presets/default-esm",
    testEnvironment: "node",
    testRegex: ".*\\.(spec|test)\\.ts$",
    coverageDirectory: "coverage",
    testEnvironment: "node",
    transform: {
        "^.+\\.(t|j)s$": "ts-jest",
    },
    collectCoverageFrom: [
        "**/src/**/*.(t|j)s",
        "!**/*index.(t|j)s",
        "!**/*test.(t|j)s",
        "!**/dist/**",
    ]
};
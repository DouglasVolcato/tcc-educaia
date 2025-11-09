/** @type {import('ts-jest').JestConfigWithTsJest} */
import jestConfig from "./jest.config";
export default {
  ...jestConfig,
  testRegex: ".*\\.spec\\.ts$",
};
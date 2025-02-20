/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.(ts|js)'],
  transformIgnorePatterns: [
    '/node_modules/(?!chalk|ansi-styles)/',
  ],
};
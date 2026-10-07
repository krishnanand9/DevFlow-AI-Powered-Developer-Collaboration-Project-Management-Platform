module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testTimeout: 60000,
  globals: { 'ts-jest': { tsconfig: { rootDir: '.', strict: true, esModuleInterop: true, skipLibCheck: true } } }
};

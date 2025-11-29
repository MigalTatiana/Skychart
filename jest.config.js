module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'routes/**/*.js',
    'middleware/**/*.js',
    'config/**/*.js',
    '!**/node_modules/**',
    '!**/test/**'
  ],
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/*.test.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/'
  ],
  verbose: true,
  forceExit: true,
  clearMocks: true
};
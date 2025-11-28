module.exports = {
    testEnvironment: 'node',
    testMatch: [
        '**/tests/**/*.test.js',
        '**/tests/**/*.spec.js'
    ],
    collectCoverageFrom: [
        'routes/**/*.js',
        'middleware/**/*.js',
        'config/**/*.js',
        '!**/node_modules/**'
    ],
    coverageDirectory: 'coverage',
    verbose: true,
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    globalTeardown: '<rootDir>/tests/teardown.js',
    testTimeout: 30000
};
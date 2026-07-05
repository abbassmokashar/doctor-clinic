module.exports = {
  testEnvironment: 'node',
  setupFiles: ['./__tests__/setup.js'],
  testMatch: ['**/__tests__/**/*.test.js'],
  verbose: true,
  collectCoverageFrom: [
    'src/controllers/*.js',
    'src/middleware/*.js',
    'src/services/*.js',
  ],
};

module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'es2023',
          lib: ['ES2023', 'DOM'],
          types: ['jest', '@testing-library/jest-dom', 'vite/client'],
          jsx: 'react-jsx',
          esModuleInterop: true,
          verbatimModuleSyntax: false,
          noUncheckedSideEffectImports: false,
        },
      },
    ],
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '\\.css$': '<rootDir>/src/__mocks__/styleMock.js',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/main.tsx',
    '!src/setupTests.ts',
    '!src/**/*.d.ts',
  ],
};

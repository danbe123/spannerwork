import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import { fileURLToPath } from 'node:url'

const tsconfigRootDir = fileURLToPath(new URL('.', import.meta.url))

export default [
  { ignores: ['dist', 'backend/dist', 'backend/node_modules', 'backend/coverage', 'node_modules', 'e2e', '*.config.js', '*.config.ts', '**/*.d.ts'] },
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        // Vitest globals
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        // React JSX runtime
        JSX: 'readonly',
      },
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
        project: './tsconfig.json',
        tsconfigRootDir,
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      // TypeScript handles undefined identifiers (no-undef is noisy in TS/JSX projects)
      'no-undef': 'off',
      // Avoid failing lint on apostrophes/quotes in JSX copy
      'react/no-unescaped-entities': 'off',
      'react/prop-types': 'off',
      'react/jsx-no-target-blank': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // TypeScript handles these better
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['backend/src/**/*.ts', 'backend/tests/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.node,
      },
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './backend/tsconfig.eslint.json',
        tsconfigRootDir,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['src/**/*.{test,spec}.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'react/display-name': 'off',
    },
  },
  {
    files: ['backend/tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
]

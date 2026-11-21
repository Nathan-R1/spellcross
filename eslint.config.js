import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules', 'public'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  { files: ['**/*.mjs'], languageOptions: { globals: { ...globals.node } } },
  {
    // Boundary rule (doc 01): the engine and content never import UI, state, React or the DOM.
    files: ['src/engine/**', 'src/content/**'],
    languageOptions: { globals: { ...globals.es2022 } },
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['**/ui/**', '**/state/**', 'react', 'react-dom', 'zustand', 'react-router*'], message: 'Engine/content must stay framework-free (doc 01).' },
        ],
      }],
    },
  },
);

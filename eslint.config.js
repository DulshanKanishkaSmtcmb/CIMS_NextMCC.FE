import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores([
    '**/dist/**',
    '**/dist-types/**',
    '**/node_modules/**',
    '**/coverage/**',
    '**/playwright-report/**',
    '**/test-results/**',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
    },
  },
  {
    // COMPONENT REGISTRY RULE (mirrors the Cargo front-end rule, see packages/ui/COMPONENT-REGISTRY.md):
    // Application code never imports @mui/* or @emotion/* directly. packages/ui is the single place
    // where MUI is wrapped, themed and documented in the component registry. If a page needs a
    // component that does not exist yet, add it to packages/ui (and the registry) instead of importing
    // MUI in the page. This rule must not be disabled or bypassed with eslint-disable comments.
    files: ['**/*.{ts,tsx}'],
    ignores: ['packages/ui/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@mui/*', '@mui/**', '@emotion/*', '@emotion/**'],
              message:
                'Import UI from @cims/ui only. Direct @mui/* and @emotion/* imports are allowed only inside packages/ui (component registry rule).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.config.{ts,js}', 'apps/web/e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  prettier,
]);

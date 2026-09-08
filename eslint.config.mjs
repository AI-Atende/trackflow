import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import eslintConfigPrettier from 'eslint-config-prettier/flat';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],

      '@typescript-eslint/no-explicit-any': 'warn',

      'prefer-const': 'error',
    },
  },

  // Desliga regras de estilo do ESLint que conflitam com o Prettier.
  // Deve vir por último para sobrescrever as configs anteriores.
  eslintConfigPrettier,

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Código gerado/artefatos que não devem ser lintados:
    'generated/**',
    'data/**',
  ]),
]);

export default eslintConfig;

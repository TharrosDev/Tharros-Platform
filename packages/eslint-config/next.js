import prettier from "eslint-config-prettier";

/**
 * Shared ESLint rules for Tharros apps, layered on top of `eslint-config-next`.
 * `prettier` disables stylistic rules that would conflict with Prettier formatting.
 * The `@typescript-eslint` plugin is already registered by eslint-config-next, so
 * we can reference its rules here without re-declaring the plugin.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export default [
  prettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

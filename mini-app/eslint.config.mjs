// @ts-check

import eslint from "@eslint/js";
import reactLint from "eslint-plugin-react";
import hooksLint from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import unusedImports from "eslint-plugin-unused-imports";

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  reactLint.configs.flat.recommended,
  hooksLint.configs["recommended-latest"],
  {
    plugins: {
      "unused-imports": unusedImports,
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      "unused-imports/no-unused-imports": "warn",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  }
);

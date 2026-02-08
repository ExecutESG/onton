// @ts-check

import eslint from "@eslint/js";
import reactLint from "eslint-plugin-react";
import hooksLint from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  reactLint.configs.flat.recommended,
  hooksLint.configs["recommended-latest"],
  {
    rules: {
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      "no-unused-imports": "warn",
      "no-unused-vars": "warn",
    },
  }
);

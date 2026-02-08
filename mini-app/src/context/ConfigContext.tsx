"use client";

import { ErrorState } from "@/app/_components/ErrorState";
import { trpc } from "@/app/_trpc/client";
import React, { createContext, useContext } from "react";

// Export ConfigContextType
export type ConfigContextType = {
  [key: string]: string | null;
};

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

const emptyObject = {};

// Add testConfig to ConfigProviderProps
interface ConfigProviderProps {
  children: React.ReactNode;
  testConfig?: ConfigContextType; // Optional testConfig prop
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ children, testConfig }) => {
  const { data, error } = trpc.config.getConfig.useQuery(undefined, {
    enabled: !testConfig, // Disable hook if testConfig is provided
  });

  if (error && !testConfig) {
    console.error("Failed to fetch config:", error);
    if (error?.data?.code === "FORBIDDEN") {
      return <ErrorState errorCode="banned" />;
    }
  }

  const configValue = testConfig || data?.config || emptyObject;

  return <ConfigContext.Provider value={configValue}>{children}</ConfigContext.Provider>;
};

export const useConfig = (): ConfigContextType => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }
  return context;
};

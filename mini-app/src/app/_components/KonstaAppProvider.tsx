"use client";

import useWebApp from "@/hooks/useWebApp";
import { App } from "konsta/react";
import { ReactNode } from "react";

const KonstaAppProvider = ({ children }: { children: ReactNode }) => {
  const webApp = useWebApp();

  return (
    <App
      theme={"ios"}
      className="min-h-full overflow-y-auto"
      style={{
        minHeight: webApp?.viewportHeight,
      }}
    >
      {children}
    </App>
  );
};

export default KonstaAppProvider;

import { FC, ReactNode } from "react";

/**
 * Legacy pre-registration tasks wall has been retired in favor of native attendee flows.
 * Passthrough wrapper to avoid breaking existing imports.
 */
const PreRegistrationTasks: FC<{ children: ReactNode }> = (props) => {
  return <>{props.children}</>;
};

export default PreRegistrationTasks;

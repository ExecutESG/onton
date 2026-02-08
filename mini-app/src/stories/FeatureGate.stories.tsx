import { trpc } from "@/app/_trpc/client"; // Your app's trpc object from createTRPCReact
import { FeatureGate } from "@/components/FeatureGate"; // Updated import path
import { ConfigContextType, ConfigProvider } from "@/context/ConfigContext";
import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCUntypedClient, httpBatchLink } from "@trpc/client";
import React, { useState } from "react";

// If you have your AppRouter type, import it for better type safety:
// import type { AppRouter } from "@/server/api/root"; // Example path, adjust as needed

// Define a type for the story args that includes mockConfig
// This ensures that mockConfig passed via args is correctly typed.
interface FeatureGateStoryArgs {
  featureName: string;
  children: React.ReactNode;
  mockConfig?: ConfigContextType; // This is the prop we pass through args in Storybook
}

// Explicitly type the Meta object to include FeatureGateProps and the custom mockConfig arg
const meta: Meta<FeatureGateStoryArgs & { component: typeof FeatureGate }> = {
  title: "Components/FeatureGate",
  component: FeatureGate,
  decorators: [
    (Story, context) => {
      const mockConfig = (context.args as FeatureGateStoryArgs).mockConfig || {};

      const [queryClient] = useState(
        () =>
          new QueryClient({
            defaultOptions: {
              queries: {
                staleTime: Infinity,
                retry: false,
              },
            },
          })
      );

      const [storyTrpcClient] = useState(() =>
        createTRPCUntypedClient({
          links: [
            httpBatchLink({
              url: "/api/trpc", // This URL likely won't be called due to `enabled: false`
              // You can also use a completely mock link if preferred:
              // () => ({ next, op }) => { observable(observer => { observer.complete(); }); }
            }),
          ],
        })
      );

      return (
        <trpc.Provider
          // @ts-expect-error - This is a workaround to avoid type errors in Storybook
          client={storyTrpcClient}
          queryClient={queryClient}
        >
          <QueryClientProvider client={queryClient}>
            <ConfigProvider testConfig={mockConfig}>
              <Story />
            </ConfigProvider>
          </QueryClientProvider>
        </trpc.Provider>
      );
    },
  ],
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  // Define argTypes for FeatureGate props and the additional mockConfig for the story
  argTypes: {
    featureName: {
      control: "text",
      description: "The name of the feature flag to check in the config.",
    },
    children: {
      control: false,
      description: "Content to render if the feature is enabled.",
    },
    // mockConfig is not a direct prop of FeatureGate, but an arg for the decorator
    // It can be defined here to show up in Storybook controls if desired.
    mockConfig: {
      control: "object",
      description: "Mock config for the ConfigProvider in the story.",
      name: "Mock Config (for Provider)", // Optional: more descriptive name in Storybook UI
    },
  },
} as Meta<FeatureGateStoryArgs>; // Cast to Meta<FeatureGateStoryArgs> to satisfy stricter checks if needed, or ensure component is part of type.

export default meta;

// Use a type that reflects the args including mockConfig for the stories themselves
type Story = StoryObj<FeatureGateStoryArgs>;

export const FeatureDisabled: Story = {
  args: {
    featureName: "betaFeature",
    children: <div>This content should NOT be visible.</div>,
    mockConfig: { betaFeature: "true" },
  },
};

export const FeatureEnabled: Story = {
  args: {
    featureName: "betaFeature",
    children: (
      <div className="p-4 bg-green-100 border border-green-400 rounded-md">
        <h2 className="text-xl font-semibold text-green-700">Beta Feature Active!</h2>
        <p className="text-green-600">
          This content is visible because the &apos;betaFeature&apos; flag is not set to true in the config.
        </p>
      </div>
    ),
    mockConfig: { anotherFeature: "someValue" },
  },
};

export const FeatureEnabledNoConfig: Story = {
  args: {
    featureName: "nonExistentFeature",
    children: (
      <div className="p-4 bg-blue-100 border border-blue-400 rounded-md">
        <h2 className="text-xl font-semibold text-blue-700">Feature Available (No Config Flag)!</h2>
        <p className="text-blue-600">This content is visible because &apos;nonExistentFeature&apos; is not in the config.</p>
      </div>
    ),
    mockConfig: {}, // Empty config
  },
};

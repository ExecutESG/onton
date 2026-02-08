import SnapShotBanner from "@/app/(landing-pages)/onion-snapshot/_components/SnapShotBanner";
import { trpc } from "@/app/_trpc/client";
import { ConfigContextType, ConfigProvider } from "@/context/ConfigContext";
import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCUntypedClient, httpBatchLink } from "@trpc/client";
import { useState } from "react";

interface AirdropBannerStoryArgs {
  mockConfig: ConfigContextType;
}

const meta: Meta<AirdropBannerStoryArgs> = {
  title: "Featured/Onion/AirdropBanner",
  component: SnapShotBanner,
  decorators: [
    (Story, context) => {
      const mockConfig = (context.args as AirdropBannerStoryArgs).mockConfig || {};

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
};

export default meta;
type Story = StoryObj<typeof SnapShotBanner>;

export const Primary: Story = {
  args: {
    className: "w-full",
    mockConfig: {
      snapshot_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10),
    },
  },
};

import WalletNotConnected from "@/app/(landing-pages)/onion-snapshot/_components/WalletNotConnected";
import type { Meta, StoryObj } from "@storybook/react";
import { TonConnectButton, TonConnectUIProvider } from "@tonconnect/ui-react";

const component = () => (
  <TonConnectUIProvider manifestUrl="https://storage.onton.live/onton/onton_manifest.json">
    <div className="w-full max-w-[360px] mx-auto h-full flex items-center justify-center border border-zinc-200 rounded-2xl">
      <WalletNotConnected>
        Yay it&apos;s connected
        <TonConnectButton />
      </WalletNotConnected>
    </div>
  </TonConnectUIProvider>
);

const meta: Meta<typeof WalletNotConnected> = {
  component,
  title: "Feedback/WalletNotConnected",
};

export default meta;
type Story = StoryObj<typeof WalletNotConnected>;

export const Primary: Story = {
  args: {},
};

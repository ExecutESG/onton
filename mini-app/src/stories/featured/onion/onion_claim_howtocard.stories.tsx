import { OnionFollowUsCard } from "@/app/(landing-pages)/onion-snapshot/claim-points/_components/OnionFollowUsCard";
import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta<typeof OnionFollowUsCard> = {
  title: "Featured/Onion/FollowUs",
  component: OnionFollowUsCard,
};

export default meta;
type Story = StoryObj<typeof OnionFollowUsCard>;

export const Primary: Story = {
  args: {},
};

import type { Meta, StoryObj } from "@storybook/react";
import { NotFound } from "./NotFound";

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
  title: "Components/NotFound",
  component: NotFound,
  parameters: {
    // Optional parameter to center the component in the Canvas.
    // More info: https://storybook.js.org/docs/react/configure/story-layout
    layout: "centered",
  },
  // This component will have an automatically generated Autodocs entry:
  // https://storybook.js.org/docs/react/writing-docs/autodocs
  tags: ["autodocs"],
  // More on argTypes: https://storybook.js.org/docs/react/api/argtypes
  argTypes: {
    // You can add argTypes here if your component has props
    // For example, if NotFoundProps had a message prop:
    // message: { control: 'text' },
  },
} satisfies Meta<typeof NotFound>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/react/writing-stories/args
export const Default: Story = {
  args: {
    // Props for the Default story can be added here
    // For example, if NotFoundProps had a message prop:
    // message: 'This is a custom not found message.',
  },
};

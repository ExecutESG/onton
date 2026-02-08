"use client";

import { trpc } from "@/app/_trpc/client";
import { ListInput } from "konsta/react";
import React, { FC } from "react";

type Category = {
  category_id: number;
  name: string;
};

const EventCategoryPicker: FC<{
  value?: number;
  onValueChange: (_value: Category) => void;
  errors?: string[];
}> = ({ value, onValueChange, errors }) => {
  const categories = trpc.events.getCategories.useQuery();

  const onCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const category = categories.data?.find((category) => category.category_id === Number(e.target.value))!;
    onValueChange(category);
  };

  return (
    <ListInput
      outline
      placeholder="Select Category"
      label="Category"
      dropdown
      name="category_id"
      type="select"
      value={value}
      onChange={onCategoryChange}
      defaultValue={"select_option"}
      error={errors?.length ? errors?.join(". ") : undefined}
    >
      <option
        disabled
        value="select_option"
      >
        Select Category
      </option>
      {categories.data?.map((category) => (
        <option
          key={category.category_id}
          value={category.category_id}
          className="text-black"
        >
          {category.name}
        </option>
      ))}
    </ListInput>
  );
};

export default EventCategoryPicker;

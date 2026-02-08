"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { KSheet } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { EventCategoryRow } from "@/db/schema/eventCategories";
import { Block, BlockTitle, Button } from "konsta/react";
import React, { useEffect, useState } from "react";

interface CategorySelectorDrawerProps {
  isOpen: boolean;
  onOpenChange: (val: boolean) => void;
  categories: EventCategoryRow[] | undefined;
  selectedCategories: string[];
  setSelectedCategories: (val: string[]) => void;
}

const CategorySelectorDrawer: React.FC<CategorySelectorDrawerProps> = ({
  isOpen,
  onOpenChange,
  categories = [],
  selectedCategories,
  setSelectedCategories,
}) => {
  const [localSelectedCategories, setLocalSelectedCategories] = useState<string[]>([]);

  useEffect(() => {
    // Whenever the drawer opens, copy the parent’s selectedCategories into local state
    if (isOpen) {
      setLocalSelectedCategories([...selectedCategories]);
    }
  }, [isOpen, selectedCategories]);

  // Toggle one category
  const toggleCategory = (catId: string) => {
    setLocalSelectedCategories((prev) => (prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]));
  };

  // Select or deselect all categories
  const selectAllCategories = () => {
    setLocalSelectedCategories(categories.map((cat) => String(cat.category_id)));
  };

  const deselectAllCategories = () => {
    setLocalSelectedCategories([]);
  };

  // Check if all categories are selected
  const allSelected = categories.length > 0 && localSelectedCategories.length === categories.length;

  // On Done, pass the final local selections back to parent
  const handleDoneClick = () => {
    setSelectedCategories(localSelectedCategories);
    onOpenChange(false);
  };

  return (
    <KSheet
      hideTrigger
      dontHandleMainButton
      open={isOpen}
      onOpenChange={onOpenChange}
    >
      <BlockTitle>Select Categories</BlockTitle>

      <Block className="my-0 space-y-2">
        <div
          className="flex justify-between items-center cursor-pointer p-0 px-10"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            allSelected ? deselectAllCategories() : selectAllCategories();
          }}
        >
          <span className="text-zinc-400">Select All</span>
          <Checkbox
            checked={allSelected}
            onCheckedChange={allSelected ? deselectAllCategories : selectAllCategories}
            className="h-5 w-5"
          />
        </div>
        <Separator className="my-2" />

        <ScrollArea className="h-[50vh] w-full rounded-md border-0 p-4 py-0">
          {categories.map((category) => {
            const catIdString = String(category.category_id);
            const checked = localSelectedCategories.includes(catIdString);

            return (
              <div
                key={category.category_id}
                className="flex justify-between items-center border-b-2 border-b-gray-800 px-6 cursor-pointer h-12"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleCategory(catIdString);
                }}
              >
                <span>{category.name}</span>
                <Checkbox
                  checked={checked}
                  className="h-6 w-6"
                />
              </div>
            );
          })}
        </ScrollArea>

        <Button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDoneClick();
          }}
        >
          Done
        </Button>
      </Block>
    </KSheet>
  );
};

export default CategorySelectorDrawer;

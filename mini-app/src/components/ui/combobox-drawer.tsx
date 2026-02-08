"use client";

import { KButton } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { CommandLoading } from "cmdk";
import { Block, Preloader, Sheet } from "konsta/react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiAlertCircle } from "react-icons/fi";

interface ComboboxDrawerProps {
  options?: { value: string; label: string }[];
  placeholder?: string;
  emptyMessage?: string;
  searchPlaceholder?: string;
  className?: string;
  isLoading?: boolean;
  defaultValue?: string;
  onSelect?: (_value: string) => void;
  errors?: (string | undefined)[];
  onInputChange?: (_inputValue: string) => void;
  disabled?: boolean;
}

export function ComboboxDrawer({
  options,
  placeholder = "Select an option...",
  emptyMessage = "No option found.",
  searchPlaceholder = "Search...",
  className,
  defaultValue,
  onSelect,
  errors,
  isLoading,
  onInputChange,
  disabled = false,
}: ComboboxDrawerProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue); // Track the selected value
  const [search, setSearch] = useState(""); // Track the search input
  const commandListRef = useRef<HTMLDivElement>(null); // Ref to control scrolling

  // Synchronize internal value state with defaultValue prop
  useEffect(() => {
    setValue(defaultValue); // Ensure the selected value is in sync with defaultValue
  }, [defaultValue]);

  // Scroll to the top when input changes
  const handleInputChange = (inputValue: string) => {
    setSearch(inputValue); // Only update search input
    onInputChange?.(inputValue); // Call onInputChange callback if provided
    if (commandListRef.current) {
      commandListRef.current.scrollTop = 0; // Scroll to the top of the CommandList
    }
  };

  // Handle when a selection is made from the list
  const handleSelect = (selectedValue: string) => {
    setValue(selectedValue); // Update the actual selected value
    setSearch(options?.find((option) => option.value === selectedValue)?.label || ""); // Update search to show the selected value
    setOpen(false); // Close the drawer
    onSelect?.(selectedValue); // Call the onSelect callback if provided
  };

  // Handle the drawer close and reset the search text if no selection is made
  const handleDrawerClose = () => {
    setOpen(false);
    // Reset the search input to the selected value when closing the drawer
    setSearch(options?.find((option) => option.value === value)?.label || "");
  };

  return (
    <div className="relative w-full">
      {/* Trigger the Drawer when the button is clicked */}
      <KButton
        role="combobox"
        tonal
        itemType="button"
        aria-expanded={open}
        className={cn(`${className} justify-between`, {
          "border-red-300 border": Boolean(errors?.length),
        })}
        // @ts-expect-error
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        disabled={disabled}
      >
        {/* Show the selected value label, or the searchPlaceholder */}
        {options?.find((option) => option.value === value)?.label || placeholder}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </KButton>
      {createPortal(
        <Sheet
          opened={open} // Bind the drawer state to `open`
          onBackdropClick={(isOpen) => {
            setOpen(isOpen); // Update the state when the drawer opens/closes
            handleDrawerClose(); // Reset search on close if no selection
          }}
          className={cn("w-full")}
        >
          <Block className="!my-2 space-y-2">
            <div className="h-[60vh]">
              <Command>
                <CommandInput
                  value={search} // Use search state
                  onValueChange={handleInputChange} // Handle input change and scroll
                  placeholder={searchPlaceholder}
                />
                <div className="overflow-y-auto overflow-x-hidden max-h-full vaul-scrollable">
                  <CommandList
                    ref={commandListRef}
                    className="max-h-full"
                  >
                    {isLoading ? (
                      <CommandLoading>
                        <div className="w-full text-center my-8">
                          <Preloader />
                          <p>Loading List</p>
                        </div>
                      </CommandLoading>
                    ) : (
                      <>
                        <CommandEmpty>{emptyMessage}</CommandEmpty>
                        <CommandGroup>
                          {options?.map((option) => (
                            <CommandItem
                              key={option.value}
                              value={option.value}
                              keywords={[option.label]}
                              onSelect={(currentValue) => {
                                handleSelect(currentValue); // Call handleSelect to update value
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                              {option.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </>
                    )}
                  </CommandList>
                </div>
              </Command>
            </div>

            {/* Close button at the bottom */}
            <KButton
              className="w-full"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
              }} // Set the drawer state to close
            >
              X Close
            </KButton>
          </Block>
        </Sheet>,
        document.body
      )}

      {errors && (
        <div className="text-red-300  pl-3 pt-1  text-sm flex items-center">
          <FiAlertCircle className="mr-2" /> {errors}
        </div>
      )}
    </div>
  );
}

"use client";

import { IconButton, InputAdornment } from "@mui/material";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { MobileDateTimePicker } from "@mui/x-date-pickers/MobileDateTimePicker";
import dayjs, { Dayjs } from "dayjs";
import { useState } from "react";

interface DatePickerRowProps {
  label: string;
  helperText?: string;
  error?: string;
  value?: Date;
  onChange: (date?: Date) => void;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  // If you want 24-hour "digital" style:
  twentyFourHour?: boolean;
}

export default function DatePickerRow({
  label,
  helperText,
  error,
  value,
  onChange,
  placeholder = "Not set",
  minDate,
  maxDate,
  twentyFourHour = true,
}: DatePickerRowProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Convert JS Date -> Dayjs
  const dayjsVal: Dayjs | null = value ? dayjs(value) : null;
  const dayjsMin = minDate ? dayjs(minDate) : undefined;
  const dayjsMax = maxDate ? dayjs(maxDate) : undefined;

  // Open/close pickers manually
  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);

  const handleChange = (newVal: Dayjs | null) => {
    onChange(newVal ? newVal.toDate() : undefined);
  };

  return (
    <div className="mb-4">
      {/* Label & helper */}
      <label className="text-sm text-gray-500 mb-1 block">{label}</label>
      {helperText && <p className="text-xs text-gray-400 mb-1">{helperText}</p>}

      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <MobileDateTimePicker
          open={isOpen}
          onOpen={handleOpen}
          onClose={handleClose}
          value={dayjsVal}
          onChange={handleChange}
          ampm={!twentyFourHour}
          minDateTime={dayjsMin}
          maxDateTime={dayjsMax}
          // Block text-field click from opening the picker automatically
          disableOpenPicker
          slotProps={{
            textField: {
              // 1) Force "standard" variant
              variant: "standard",
              // 2) Remove underline logic

              // 3) Provide "Select Time" link via endAdornment

              placeholder,
              error: !!error,
              helperText: error,

              // 4) Add custom styling with both `className` (Tailwind) & `sx` override
              className: "text-sm !bg-white !py-2 !px-4 !rounded-md  !border-none w-full",
              sx: {
                // Force removal of any leftover underline
                ".MuiInputBase-root:before": {
                  borderBottom: "none !important",
                },
                ".MuiInputBase-root:after": {
                  borderBottom: "none !important",
                },
                // If there's a hover line, also remove it
                ".MuiInputBase-root:hover:not(.Mui-disabled):before": {
                  borderBottom: "none !important",
                },
              },

              // Put the "Select Time" link on the right side
              InputProps: {
                disableUnderline: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={(e) => {
                        e.preventDefault();
                        handleOpen();
                      }}
                      size="small"
                      style={{ padding: 4 }}
                    >
                      <span className="text-blue-600 text-sm underline">Select Time</span>
                    </IconButton>
                  </InputAdornment>
                ),
              },
            },
            mobilePaper: {
              sx: {
                width: "100% !important",
                height: "100% !important",
                margin: 0,
                borderRadius: 0,
              },
            },
          }}
        />
      </LocalizationProvider>
    </div>
  );
}

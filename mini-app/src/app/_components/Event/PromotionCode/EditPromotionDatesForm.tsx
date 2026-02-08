"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { trpc } from "@/app/_trpc/client";
import couponSchema from "@/zodSchema/couponSchema";

import NavigationButtons, { NavAction } from "@/components/NavigationButtons";
import ConfirmDialog from "./ConfirmDialog";
import DatePickerRow from "./DatePickerRow";
import PlusMinusInput from "./PlusMinusInput";
import SuccessDialog from "./SuccessDialog";

// We only want to mutate the dates. So let's define a type that has
// { id, event_uuid, start_date, end_date } from your `editCouponDatesSchema`.
// We'll store count, value for display only.

type EditPromotionFormValues = z.infer<typeof couponSchema.editCouponDatesSchema>;

interface EditPromotionFormProps {
  id: number;
  eventUuid: string;

  // read-only fields for count & value
  initialCount: number;
  initialValue: number;

  // The existing start/end for default values
  initialStartDate: Date;
  initialEndDate: Date;

  onDone?: () => void;
}

export default function EditPromotionForm({
  id,
  eventUuid,
  initialCount,
  initialValue,
  initialStartDate,
  initialEndDate,
  onDone,
}: EditPromotionFormProps) {
  // 1) Setup form, but we only need to store date fields in the final mutation
  // The "count" & "value" we'll show as read-only in the UI.
  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<EditPromotionFormValues>({
    resolver: zodResolver(couponSchema.editCouponDatesSchema),
    mode: "onBlur",
    defaultValues: {
      id,
      event_uuid: eventUuid,
      start_date: initialStartDate,
      end_date: initialEndDate,
    },
  });

  const updateDatesMutation = trpc.coupon.editCouponDefinitionDates.useMutation();

  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // For end_date logic
  const startValue = watch("start_date");

  // "Update" => open confirm
  const handleUpdateClick = handleSubmit(() => {
    setShowConfirm(true);
  });

  // Actually mutate
  const handleConfirmSave = handleSubmit((data) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    // Only update start_date & end_date. The server side will ignore
    // count/value anyway, because your `editCouponDefinitionDates` only wants {id, event_uuid, start_date, end_date}.
    updateDatesMutation.mutate(data, {
      onSuccess: () => {
        setIsSubmitting(false);
        setShowConfirm(false);
        setShowSuccess(true);
      },
      onError: (err) => {
        setIsSubmitting(false);
        alert(`Failed to update coupon dates: ${err.message}`);
      },
    });
  });

  const handleCancelClick = () => {
    onDone?.();
  };
  const handleDiscard = () => {
    setShowConfirm(false);
    onDone?.();
  };
  const handleSuccessDone = () => {
    setShowSuccess(false);
    onDone?.();
  };

  // Bottom pinned actions
  const actions: NavAction[] = [
    {
      label: "Update",
      onClick: (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleUpdateClick();
      },
    },
    {
      label: "Cancel",
      colors: { textIos: "text-primary", textMaterial: "text-primary" },
      outline: true,
      onClick: (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleCancelClick();
      },
    },
  ];

  return (
    <div className="relative min-h-screen mb-4.5">
      <div className="px-4">
        <h1 className="text-lg font-bold">Edit Promotion</h1>
      </div>

      <div className="px-4 pt-4">
        <p className="text-sm text-gray-700 mb-4">
          Updating only the dates. Number of Codes and Discount cannot be changed here.
        </p>

        {/* 1) Count (READ-ONLY) */}
        <div className="mb-4">
          <PlusMinusInput
            label="Number of Codes"
            value={initialCount}
            onChange={() => {}}
            error={""}
            disabled={true}
          />
        </div>

        {/* 2) Discount Value (READ-ONLY) */}
        <div className="mb-4">
          <PlusMinusInput
            label="Discount Code Percentage"
            unitLabel="%"
            value={initialValue}
            onChange={() => {}}
            error={""}
            disabled={true}
          />
        </div>

        {/* 3) Start Date (edit) */}
        <Controller
          name="start_date"
          control={control}
          render={({ field }) => (
            <DatePickerRow
              label="Activate at"
              helperText="Must be today or later."
              placeholder="Not set"
              error={errors.start_date?.message}
              value={field.value}
              onChange={field.onChange}
              minDate={new Date()}
            />
          )}
        />

        {/* 4) End Date (edit) */}
        <Controller
          name="end_date"
          control={control}
          render={({ field }) => {
            if (!startValue) {
              return (
                <div className="mb-4">
                  <label className="text-sm text-gray-500 mb-1 block">Deactivate at</label>
                  <p className="text-xs text-gray-400 mb-1">It is set to the event start time by default.</p>
                  <div
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      alert("You must select start date first!");
                    }}
                    className="bg-gray-100 p-3 rounded shadow-sm text-sm text-gray-500 cursor-pointer"
                  >
                    Please pick the start date first
                  </div>
                </div>
              );
            }
            return (
              <DatePickerRow
                label="Deactivate at"
                helperText="It is set to the event start time by default."
                placeholder="Not set"
                error={errors.end_date?.message}
                value={field.value}
                // minDate => can't pick end < start
                minDate={startValue}
                onChange={field.onChange}
              />
            );
          }}
        />
      </div>

      <NavigationButtons
        layout="vertical"
        actions={actions}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        opened={showConfirm}
        onBackdropClick={() => setShowConfirm(false)}
        isSubmitting={isSubmitting}
        onConfirm={handleConfirmSave}
        onBack={handleDiscard}
      />

      {/* Success Dialog */}
      <SuccessDialog
        opened={showSuccess}
        onBackdropClick={() => setShowSuccess(false)}
        onDone={handleSuccessDone}
      />
    </div>
  );
}

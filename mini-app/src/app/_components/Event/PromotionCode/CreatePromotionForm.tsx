"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { z } from "zod";

import { trpc } from "@/app/_trpc/client";
import couponSchema from "@/zodSchema/couponSchema";

import NavigationButtons, { NavAction } from "@/components/NavigationButtons";
import ConfirmDialog from "./ConfirmDialog";
import DatePickerRow from "./DatePickerRow";
import PlusMinusInput from "./PlusMinusInput";
import SuccessDialog from "./SuccessDialog";

// 🆕  UI helpers
import { UploadCsvFile } from "@/components/ui/upload-csv-file";
import { Block, BlockTitle, Button, Popup, Radio } from "konsta/react";
import { FileText } from "lucide-react";

// type AddCouponsFormValues = z.infer<typeof couponSchema.addCouponsSchema>;
// type AddCouponsCsvValues = z.infer<typeof couponSchema.addCouponsCsvSchema>;
type FormValues = {
  event_uuid: string;
  value: number;
  start_date: Date;
  end_date: Date;
  count?: number; // ← optional now
  csv_text?: string;
};
interface CreatePromotionFormProps {
  eventUuid: string;
  onDone?: () => void;
}

// ---------------------------------------------
// component
// ---------------------------------------------
export default function CreatePromotionForm({ eventUuid, onDone }: CreatePromotionFormProps) {
  // 🆕  local state: which generation method?
  const [mode, setMode] = useState<"count" | "csv">("count");
  const [csvText, setCsvText] = useState<string>(); // raw text from uploader
  const [showCsvInfo, setShowCsvInfo] = useState(false);
  // 🆕  pick a Zod schema based on mode
  const currentSchema = mode === "count" ? couponSchema.addCouponsSchema : couponSchema.addCouponsCsvSchema;

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset, // 🆕 to clear count when switching modes
  } = useForm<FormValues>({
    resolver: zodResolver(currentSchema as any),
    mode: "onBlur",
    defaultValues: { event_uuid: eventUuid, count: 1 },
  });

  // 🆕  mutations
  const addCouponsMutation = trpc.coupon.addCoupons.useMutation();
  const addCouponsCsvMutation = trpc.coupon.addCouponsCsv.useMutation();

  // ---------------------------------------------
  // local dialog state
  // ---------------------------------------------
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // watch start_date for end_date min
  const startValue = watch("start_date");

  // ---------------------------------------------
  // mode switch – clear irrelevant fields
  // ---------------------------------------------
  useEffect(() => {
    if (mode === "csv") {
      reset((old) => ({ ...old, count: undefined }));
      setCsvText(undefined);
      setShowCsvInfo(true); // ← open modal
    } else {
      setCsvText(undefined);
    }
  }, [mode, reset]);

  // ---------------------------------------------
  // open confirm dialog after validation
  // ---------------------------------------------
  const handleGenerateCodesClick = handleSubmit(() => setShowConfirm(true));

  const handleCancelClick = () => onDone?.();

  // ---------------------------------------------
  // confirm dialog action
  // ---------------------------------------------
  const handleConfirmSave: SubmitHandler<FormValues> = (data) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    if (mode === "count") {
      // data.count is defined here, safe to cast
      addCouponsMutation.mutate(data as unknown as z.infer<typeof couponSchema.addCouponsSchema>, callbacks);
    } else {
      addCouponsCsvMutation.mutate(
        {
          event_uuid: data.event_uuid,
          csv_text: csvText!, // we ensured it exists
          value: data.value,
          start_date: data.start_date,
          end_date: data.end_date,
        },
        callbacks
      );
    }
  };
  const callbacks = {
    onSuccess: () => {
      setIsSubmitting(false);
      setShowConfirm(false);
      setShowSuccess(true);
    },
    onError: (err: any) => {
      setIsSubmitting(false);
      alert(`Failed to create coupons: ${err.message}`);
    },
  };

  const actions: NavAction[] = [
    {
      label: "Generate Codes",
      onClick: (e) => {
        e.preventDefault();
        handleGenerateCodesClick();
      },
    },
    {
      label: "Cancel",
      outline: true,
      colors: { textIos: "text-primary", textMaterial: "text-primary" },
      onClick: (e) => {
        e.preventDefault();
        handleCancelClick();
      },
    },
  ];

  // ---------------------------------------------
  // render
  // ---------------------------------------------
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#EFEFF4] ">
      <div className="grow overflow-y-auto p-4 py-0 my-0 ">
        {/* 🆕  Generation-method toggle */}

        <div className="flex flex-col gap-2  my-2  text-sm">
          <label className="flex items-center gap-2">
            <Radio
              checked={mode === "count"}
              onChange={() => setMode("count")}
            />
            By quantity
          </label>
          <label className="flex items-center gap-2">
            <Radio
              checked={mode === "csv"}
              onChange={() => setMode("csv")}
            />
            Upload CSV of Telegram IDs
          </label>
        </div>
        {/* CSV uploader – only in csv mode */}
        {mode === "csv" && (
          <>
            <UploadCsvFile
              triggerText="Upload Invite CSV"
              infoText="Max 5 000 rows"
              changeText="Change CSV"
              onDone={(text) => {
                setCsvText(text);
                setValue("csv_text", text, { shouldValidate: true }); // ← NEW
              }}
              isError={!csvText && isSubmitting && mode === "csv"}
            />
          </>
        )}

        <div className="mt-4">
          {/* Discount Value – common */}
          <Controller
            control={control}
            name="value"
            render={({ field }) => (
              <PlusMinusInput
                label="Discount Code Percentage"
                unitLabel="%"
                value={field.value ?? 0}
                onChange={field.onChange}
                error={errors.value?.message}
              />
            )}
          />
          {/* Quantity input – only in count mode */}
          {mode === "count" && (
            <Controller
              control={control}
              name="count"
              render={({ field }) => (
                <PlusMinusInput
                  label="Number of Codes"
                  value={field.value ?? 0}
                  onChange={field.onChange}
                  error={errors.count?.message}
                />
              )}
            />
          )}

          {/* Start Date */}
          <Controller
            control={control}
            name="start_date"
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

          {/* End Date */}
          <Controller
            control={control}
            name="end_date"
            render={({ field }) => {
              if (!startValue) {
                return (
                  <div className="mb-4">
                    <label className="text-sm text-gray-500 mb-1 block">Deactivate at</label>
                    <p className="text-xs text-gray-400 mb-1">It is set to the event start time by default.</p>
                    <div
                      onClick={() => alert("You must select start date first!")}
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
                  minDate={startValue}
                  onChange={field.onChange}
                />
              );
            }}
          />
        </div>
      </div>
      {mode === "csv" && (
        <Popup
          opened={showCsvInfo}
          onBackdropClick={() => setShowCsvInfo(false)}
          className="w-full max-w-md"
        >
          <BlockTitle className="flex items-start-l gap-2">Accepted CSV formats</BlockTitle>

          <Block className="space-y-2 text-sm">
            <p>
              Your file should have <strong>one column only</strong> – either
              <code className="font-mono px-1">user_id</code> <em>or</em> <code className="font-mono px-1">user_name</code>.
              One is enough; you don’t need both.
            </p>

            <p>Examples:</p>

            <pre className="bg-white border p-2 rounded whitespace-pre-wrap text-[10px] leading-4">
              user_id 123456789 987654321
            </pre>

            <pre className="bg-white border p-2 rounded whitespace-pre-wrap text-[10px] leading-4">
              user_name alice @bob https://t.me/charlie
            </pre>

            <Button
              rounded
              large
              onClick={() => setShowCsvInfo(false)}
              className="mt-2"
            >
              Got it
            </Button>
          </Block>
        </Popup>
      )}
      {/* dialogs */}
      <ConfirmDialog
        opened={showConfirm}
        onBackdropClick={() => setShowConfirm(false)}
        isSubmitting={isSubmitting}
        onConfirm={handleSubmit(handleConfirmSave)}
        onBack={() => setShowConfirm(false)}
      />

      <SuccessDialog
        opened={showSuccess}
        onBackdropClick={() => setShowSuccess(false)}
        onDone={() => {
          setShowSuccess(false);
          onDone?.();
        }}
      />
      <NavigationButtons
        layout="vertical"
        actions={actions}
      />
    </div>
  );
}

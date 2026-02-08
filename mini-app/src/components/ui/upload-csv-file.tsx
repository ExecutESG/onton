"use client";

import useWebApp from "@/hooks/useWebApp";
import { getErrorMessages } from "@/lib/error";
import { cn } from "@/lib/utils";
import { Block, BlockTitle, Sheet } from "konsta/react";
import { FileUp, CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, KButton } from "./button";

type UploadCsvFileProps = {
  triggerText: React.ReactNode;
  infoText?: React.ReactNode;
  changeText: React.ReactNode;
  /** called once the CSV passes validation (≤ 5 000 rows) */
  onDone?: (csvText: string) => void;
  /** optional initial CSV text */
  defaultCsv?: string;
  drawerDescriptionText?: string;
  isError?: boolean;
  disabled?: boolean;
};

export const UploadCsvFile = ({
  triggerText,
  infoText,
  changeText,
  onDone,
  defaultCsv,
  drawerDescriptionText,
  isError,
  disabled,
}: UploadCsvFileProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const webApp = useWebApp();

  /* ­–––– local state ­–––– */
  const [csvName, setCsvName] = useState<string>();
  const [rowCount, setRowCount] = useState<number>();
  const [csvText, setCsvText] = useState<string | undefined>(defaultCsv);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(isError ? "Invalid file" : undefined);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  /* Hide Telegram MainButton while drawer open */
  useEffect(() => {
    if (isSheetOpen) webApp?.MainButton.hide();
    else webApp?.MainButton.show();
  }, [isSheetOpen, webApp]);

  /* ––– file picker handler ––– */
  const handleFileSelected = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setErrorMessage("File must have .csv extension");
      return;
    }

    try {
      const text = await file.text();
      const rows = text.trim().split(/\r?\n/);
      if (rows.length === 0) {
        setErrorMessage("CSV is empty");
        return;
      }
      if (rows.length > 5000) {
        setErrorMessage("CSV may contain at most 5 000 rows");
        return;
      }

      /* everything OK → update UI & bubble up */
      setCsvName(file.name);
      setCsvText(text);
      setRowCount(rows.length);
      setErrorMessage(undefined);
      onDone?.(text);
      setIsSheetOpen(false);
    } catch {
      setErrorMessage("Could not read file");
    }
  };

  /* ––– render ––– */
  return (
    <>
      {/* trigger button */}
      <Button
        type="button"
        variant={isError ? "destructive" : "outline"}
        onClick={(e) => {
          e.preventDefault();
          if (!disabled) setIsSheetOpen(true);
        }}
        className={cn(
          "w-full h-auto bg-primary/10 flex flex-col border border-dashed rounded-xl p-3 gap-3.5",
          isError ? "border-red-300 bg-red-400/10" : "border-cn-primary",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        {csvName ? (
          <p className="font-semibold flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-5" />
            {changeText} ({csvName})
          </p>
        ) : (
          <>
            <p className="font-semibold flex items-center gap-2 text-sm">
              <FileUp className="w-5" />
              {triggerText}
            </p>
            {infoText && <p className="text-cn-muted-foreground text-sm w-full text-balance">{infoText}</p>}
          </>
        )}
      </Button>

      {/* slide-up sheet */}
      {createPortal(
        <Sheet
          opened={isSheetOpen}
          onBackdropClick={() => setIsSheetOpen(false)}
          className="w-full"
        >
          <BlockTitle>Upload CSV</BlockTitle>
          <Block className="space-y-2">
            {!csvName && (
              <p>
                {drawerDescriptionText ??
                  "Select a .csv with one column: telegram_user_id (plus an optional username column). Max 5 000 rows."}
              </p>
            )}

            {csvName && (
              <p className="text-center text-sm">
                <b>{csvName}</b> — {rowCount ?? "…"} {rowCount === 1 ? "row" : "rows"}
              </p>
            )}

            {errorMessage && (
              <div className="text-red-500 text-sm break-words">
                {getErrorMessages(errorMessage).map((m, i) => (
                  <p key={i}>{m}</p>
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                e.preventDefault();
                handleFileSelected();
              }}
            />

            <KButton
              itemType="button"
              clear
              className="flex items-center gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="w-5" /> <span>{csvName ? "Change file" : "Choose file"}</span>
            </KButton>
          </Block>
        </Sheet>,
        document.body
      )}
    </>
  );
};

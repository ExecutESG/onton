import { Block } from "konsta/react";
import { UploadCsvFile } from "@/components/ui/upload-csv-file";

export const CsvUpload = ({ onCsvReady, isError }: { onCsvReady: (csvText: string) => void; isError?: boolean }) => (
  <Block>
    <UploadCsvFile
      triggerText="Upload Invite CSV"
      infoText="Max 5 000 rows"
      changeText="Change CSV"
      drawerDescriptionText="CSV must contain a numeric telegram_user_id column (username optional)."
      onDone={onCsvReady}
      isError={isError}
    />
  </Block>
);

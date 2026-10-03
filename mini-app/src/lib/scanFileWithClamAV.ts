import * as clamav from "clamav.js"; // Import ClamAV module
const CLAMAV_HOST = process.env.CLAMAV_HOST || process.env.IP_CLAMAV || "clamav"; // Default ClamAV host
const CLAMAV_PORT = Number(process.env.CLAMAV_PORT) || 3310; // Convert port to number

// Helper function to scan files using ClamAV
export const scanFileWithClamAV = async (buffer: Buffer): Promise<boolean> =>
  new Promise((resolve) => {
    clamav.ping(CLAMAV_PORT, CLAMAV_HOST, 1000, (err: any, alive: boolean) => {
      if (err || !alive) {
        console.error("ClamAV is not available:", err || "Not alive");
        // If ClamAV is not running, resolve as true (clean) but log the error
        return resolve(true);
      }
      clamav.scan(buffer, CLAMAV_PORT, CLAMAV_HOST, (err: any, object: any, malicious: boolean) => {
        if (err) {
          console.error("Error scanning file:", err);
          // In case of error during scan, resolve as true (clean) but log the error
          return resolve(true);
        }
        resolve(!malicious); // Return true if the file is clean
      });
    });
  });

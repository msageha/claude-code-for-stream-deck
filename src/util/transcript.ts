import { open, stat } from "node:fs/promises";

/** Read at most the last 256 KB — enough to find the latest assistant model line. */
const MAX_READ_BYTES = 256 * 1024;

/**
 * Extract the model identifier from a Claude Code transcript JSONL file.
 * Scans from the end to find the most recent assistant message with a model field.
 * Only the tail of the file is read so huge transcripts don't exhaust memory.
 */
export async function extractModel(transcriptPath: string): Promise<string | null> {
  let data: string;
  try {
    const { size } = await stat(transcriptPath);
    const start = Math.max(0, size - MAX_READ_BYTES);
    const length = size - start;
    const fh = await open(transcriptPath, "r");
    try {
      const buf = Buffer.alloc(length);
      const { bytesRead } = await fh.read(buf, 0, length, start);
      data = buf.subarray(0, bytesRead).toString("utf-8");
    } finally {
      await fh.close();
    }
  } catch {
    return null;
  }

  // When reading a tail slice the first line may be truncated; JSON.parse fails
  // on it and it is skipped, which is harmless since we scan newest-first.
  const lines = data.trimEnd().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const record = JSON.parse(lines[i]);
      if (record.type === "assistant" && record.message?.model) {
        return record.message.model;
      }
    } catch {
      // skip malformed lines
    }
  }
  return null;
}

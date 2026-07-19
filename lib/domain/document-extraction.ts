import { inflateRawSync } from "node:zlib";

export type ExtractionResult = {
  text: string;
  language: string;
  warnings: string[];
  redactionSummary: Record<string, number>;
};

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function stripRtf(value: string) {
  return value
    .replace(/\\'[0-9a-fA-F]{2}/g, " ")
    .replace(/\\[a-zA-Z]+\d* ?/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPdfText(buffer: Buffer) {
  const raw = buffer.toString("latin1");
  const matches = [...raw.matchAll(/\((?:\\.|[^\\)]){2,}\)/g)].map((match) =>
    match[0]
      .slice(1, -1)
      .replace(/\\n/g, " ")
      .replace(/\\r/g, " ")
      .replace(/\\t/g, " ")
      .replace(/\\([()\\])/g, "$1"),
  );
  return matches.join(" ").replace(/\s+/g, " ").trim();
}

function findEndOfCentralDirectory(buffer: Buffer) {
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65557); offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

function readZipEntry(buffer: Buffer, wantedName: string) {
  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd < 0) return null;
  const entries = buffer.readUInt16LE(eocd + 10);
  let centralOffset = buffer.readUInt32LE(eocd + 16);

  for (let index = 0; index < entries; index += 1) {
    if (buffer.readUInt32LE(centralOffset) !== 0x02014b50) return null;
    const method = buffer.readUInt16LE(centralOffset + 10);
    const compressedSize = buffer.readUInt32LE(centralOffset + 20);
    const nameLength = buffer.readUInt16LE(centralOffset + 28);
    const extraLength = buffer.readUInt16LE(centralOffset + 30);
    const commentLength = buffer.readUInt16LE(centralOffset + 32);
    const localOffset = buffer.readUInt32LE(centralOffset + 42);
    const name = buffer.subarray(centralOffset + 46, centralOffset + 46 + nameLength).toString("utf8");

    if (name === wantedName) {
      if (buffer.readUInt32LE(localOffset) !== 0x04034b50) return null;
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      if (method === 0) return compressed;
      if (method === 8) return inflateRawSync(compressed);
      return null;
    }
    centralOffset += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

function extractDocxText(buffer: Buffer) {
  const documentXml = readZipEntry(buffer, "word/document.xml");
  if (!documentXml) return "";
  return decodeXml(
    documentXml
      .toString("utf8")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " "),
  ).trim();
}

function redactPersonalData(text: string) {
  let redacted = text;
  const summary: Record<string, number> = {};
  const rules: Array<[string, RegExp, string]> = [
    ["email", /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]"],
    ["phone", /(?:\+?\d[\d\s()./-]{7,}\d)/g, "[REDACTED_PHONE]"],
    ["personnelNumber", /\b(?:Personalnr\.?|Mitarbeiter(?:nummer)?|Employee ID)\s*[:#]?\s*[A-Z0-9-]{3,}\b/gi, "[REDACTED_PERSON_REFERENCE]"],
  ];
  for (const [key, pattern, replacement] of rules) {
    const matches = redacted.match(pattern);
    summary[key] = matches?.length ?? 0;
    redacted = redacted.replace(pattern, replacement);
  }
  return { text: redacted, summary };
}

function detectLanguage(text: string) {
  const lower = text.toLowerCase();
  const germanHits = [" und ", " der ", " die ", " das ", " verantwortung", " kenntnisse", " aufgaben"].filter((item) => lower.includes(item)).length;
  const englishHits = [" and ", " the ", " responsibility", " skills", " tasks", " requirements"].filter((item) => lower.includes(item)).length;
  return germanHits >= englishHits ? "de" : "en";
}

export async function extractTextFromFile(file: File): Promise<ExtractionResult> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  const warnings: string[] = [];
  let text = "";

  if (mime.startsWith("text/") || /\.(txt|md|csv)$/i.test(name)) {
    text = buffer.toString("utf8");
  } else if (mime.includes("rtf") || name.endsWith(".rtf")) {
    text = stripRtf(buffer.toString("utf8"));
  } else if (mime.includes("wordprocessingml") || name.endsWith(".docx")) {
    text = extractDocxText(buffer);
    if (!text) warnings.push("DOCX-Text konnte nicht vollstaendig extrahiert werden.");
  } else if (mime.includes("pdf") || name.endsWith(".pdf")) {
    text = extractPdfText(buffer);
    if (!text) warnings.push("PDF enthaelt moeglicherweise Scan-Inhalte; OCR ist im lokalen Platzhalter nicht aktiv.");
  } else {
    text = buffer.toString("utf8");
    warnings.push("Dateityp nicht explizit unterstuetzt; UTF-8-Fallback verwendet.");
  }

  const normalized = text.replace(/\u0000/g, " ").replace(/\s+/g, " ").trim();
  const redacted = redactPersonalData(normalized);
  if (redacted.text.length < 200) warnings.push("Extrahierter Text ist kurz; Review muss fehlende Angaben besonders pruefen.");
  return {
    text: redacted.text.slice(0, 100_000),
    language: detectLanguage(redacted.text),
    warnings,
    redactionSummary: redacted.summary,
  };
}

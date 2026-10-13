/**
 * Structured logging. The logger is a value passed explicitly; the only side effect
 * lives in the sink you choose.
 *
 * @module
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

/** A log record. Keep fields flat and free of secrets or personal data. */
export type LogRecord = Readonly<Record<string, unknown>> & {
  readonly level: LogLevel;
  readonly msg: string;
};

/** Where records go. */
export type LogSink = (record: LogRecord) => void;

export interface Logger {
  readonly log: (level: LogLevel, msg: string, fields?: Readonly<Record<string, unknown>>) => void;
}

/** A sink that writes one JSON line per record to the console. */
export const consoleSink: LogSink = (record) => {
  const line = JSON.stringify(record);
  if (record.level === "error") console.error(line);
  else if (record.level === "warn") console.warn(line);
  else console.log(line);
};

/** A sink that discards everything. */
export const nullSink: LogSink = () => {};

/** Build a logger over `sink`, stamping each record with `now()`. */
export function createLogger(sink: LogSink, now: () => number = Date.now): Logger {
  return {
    log: (level, msg, fields = {}) =>
      sink({ ...fields, time: new Date(now()).toISOString(), level, msg }),
  };
}

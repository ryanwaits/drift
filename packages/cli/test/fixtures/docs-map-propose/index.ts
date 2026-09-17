/** Client constructor options. */
export interface ClientOptions {
  /** API host */
  host?: string;
  /** Flush interval ms */
  flushInterval?: number;
  /** Public API key */
  apiKey?: string;
  /** Request timeout ms */
  timeout?: number;
  /** Retry count */
  retry?: number;
  /** Debug logging */
  debug?: boolean;
  /** W3C tracing headers */
  tracingHeaders?: boolean;
  /** Session token — internal by convention */
  token?: string;
  missing01?: string;
  missing02?: string;
  missing03?: string;
  missing04?: string;
  missing05?: string;
  missing06?: string;
  missing07?: string;
  missing08?: string;
  missing09?: string;
  missing10?: string;
  _private?: string;
}

/** Decoy — overlaps host/flushInterval/apiKey only. */
export interface OtherOptions {
  host?: string;
  flushInterval?: number;
  apiKey?: string;
  extraFoo?: string;
}

/** Decoy — overlaps host/timeout/apiKey only. */
export interface NetworkOptions {
  host?: string;
  timeout?: number;
  apiKey?: string;
  extraBar?: string;
}

export function createClient(_options: ClientOptions): void {}

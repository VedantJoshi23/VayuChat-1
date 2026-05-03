/** Matches the DatasetFormat union in datasetStore.ts */
export type DatasetFormat = 'pkl' | 'csv' | 'json';

export interface DatasetMetadata {
  name: string;
  path: string;
  size: number;
  /** 'pkl' = Pickle binary, 'csv' = comma-separated, 'json' = JSON array/object */
  format: DatasetFormat;
  loadedAt: string | null;
  columns?: string[];
  rowCount?: number;
}

export interface AirQualityData {
  date?: string[];
  timestamp?: number[];
  pm25?: number[];
  pm10?: number[];
  no2?: number[];
  so2?: number[];
  o3?: number[];
  co?: number[];
  [key: string]: any;
}

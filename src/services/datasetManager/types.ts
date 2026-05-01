export interface DatasetMetadata {
  name: string;
  path: string;
  size: number;
  columns: string[];
  rowCount?: number;
  createdAt?: number;
}

export interface AirQualityData {
  timestamp: number[];
  PM25: number[];
  PM10: number[];
  NO2: number[];
  SO2: number[];
  O3: number[];
  CO: number[];
  [key: string]: any;
}

"""
csv_utils.py — Chaquopy module for CSV dataset loading via pandas.

Why pandas instead of the JS parseCSV():
  - pandas read_csv() uses a C engine and is 10-100× faster than
    character-by-character JS parsing for multi-MB files.
  - Runs on the Kotlin IO thread, NOT the JS thread.
  - Correct handling of quoted fields, embedded newlines, mixed types.
  - Same cache + chunk pattern as pkl_utils.

NaN / Infinity handling:
  df.where(pd.notnull(df), None) is a NO-OP for float64 columns — numpy
  stores None back as NaN because float arrays cannot hold Python objects.
  json.dumps() then serialises NaN as the bare token NaN, which is invalid
  JSON and causes JSON.parse() to throw "Unexpected character: N".

  Fix: replace ±Infinity with NaN in _normalise(), then use
  DataFrame.to_json(orient='records') for serialisation. to_json() converts
  NaN → null and datetimes → ISO strings natively and correctly.
"""
import numpy as np
import pandas as pd

_cached_path: str | None = None
_cached_df: "pd.DataFrame | None" = None


def _normalise(df: pd.DataFrame) -> pd.DataFrame:
    # ±Infinity is not representable as JSON; replace with NaN so to_json
    # maps them to null alongside ordinary missing values.
    df = df.replace([np.inf, -np.inf], np.nan)

    # Localise timezone-aware datetime columns to UTC then strip the tz so
    # to_json can format them as plain ISO date strings without errors.
    for col in df.select_dtypes(include=["datetimetz"]).columns:
        df[col] = df[col].dt.tz_convert("UTC").dt.tz_localize(None)

    return df


def _get_df(file_path: str) -> pd.DataFrame:
    global _cached_path, _cached_df
    if _cached_path != file_path:
        df = pd.read_csv(file_path, low_memory=False)
        _cached_df = _normalise(df)
        _cached_path = file_path
    return _cached_df  # type: ignore[return-value]


def get_metadata(file_path: str) -> str:
    """Return {columns, rowCount} after reading the file once."""
    import json
    df = _get_df(file_path)
    return json.dumps(
        {"columns": list(df.columns), "rowCount": int(len(df))}
    )


def load_chunk(file_path: str, offset: int, limit: int) -> str:
    """
    Serialise rows [offset, offset+limit) as a valid JSON array string.

    Uses DataFrame.to_json() which correctly converts:
      NaN          → null
      ±Infinity    → null   (after _normalise replaces them with NaN)
      datetime64   → ISO 8601 string
      Non-ASCII    → kept as-is (force_ascii=False)
    """
    df = _get_df(file_path)
    if offset >= len(df):
        return "[]"
    chunk = df.iloc[offset : offset + limit]
    return chunk.to_json(
        orient="records",
        date_format="iso",
        default_handler=str,
        force_ascii=False,
    )


def evict_cache() -> None:
    global _cached_path, _cached_df
    _cached_path = None
    _cached_df = None

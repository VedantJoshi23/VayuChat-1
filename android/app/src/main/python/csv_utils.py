"""
csv_utils.py — Chaquopy module for CSV dataset loading via pandas.

Why pandas instead of the JS parseCSV():
  - pandas read_csv() uses a C engine and is 10-100× faster than character-
    by-character JS parsing for multi-MB files.
  - Runs on the Kotlin IO thread, NOT the JS thread, so the UI stays
    responsive even for a 23 MB file.
  - Correct handling of quoted fields, embedded newlines, mixed types.
  - The same cache + chunk pattern as pkl_utils so large files are read once
    and served in 5 000-row slices.
"""
import json
import pandas as pd

_cached_path: str | None = None
_cached_df: "pd.DataFrame | None" = None


def _normalise(df: pd.DataFrame) -> pd.DataFrame:
    for col in df.select_dtypes(include=["datetime64", "datetimetz"]).columns:
        df[col] = df[col].dt.strftime("%Y-%m-%d")
    df = df.where(pd.notnull(df), None)
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
    df = _get_df(file_path)
    return json.dumps(
        {"columns": list(df.columns), "rowCount": int(len(df))},
        default=str,
    )


def load_chunk(file_path: str, offset: int, limit: int) -> str:
    """Serialise rows [offset, offset+limit) as a JSON array string."""
    df = _get_df(file_path)
    if offset >= len(df):
        return "[]"
    chunk = df.iloc[offset : offset + limit]
    return json.dumps(chunk.to_dict(orient="records"), default=str)


def evict_cache() -> None:
    global _cached_path, _cached_df
    _cached_path = None
    _cached_df = None

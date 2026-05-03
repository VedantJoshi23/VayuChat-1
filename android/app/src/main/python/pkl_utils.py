"""
pkl_utils.py — Chaquopy module for pickle dataset loading.

NaN / Infinity handling (same root cause as csv_utils.py):
  df.where(pd.notnull(df), None) is a NO-OP for float64 columns.
  json.dumps() then produces the bare token NaN which JavaScript's JSON.parse()
  correctly rejects with "Unexpected character: N".

  Fix: replace ±Infinity with NaN in _normalise(), then serialise with
  DataFrame.to_json(orient='records') which maps NaN → null natively.

Cache policy:
  At most one DataFrame is held in module-level memory.  Loading a different
  path evicts the previous entry so Python heap usage stays bounded.
  get_metadata() reads only column names + row count — no row serialisation.
  load_chunk(offset, limit) serialises only the requested slice.
"""
import numpy as np
import pandas as pd

_cached_path: str | None = None
_cached_df: "pd.DataFrame | None" = None


def _normalise(df: pd.DataFrame) -> pd.DataFrame:
    # Replace ±Infinity with NaN so to_json maps them to null.
    df = df.replace([np.inf, -np.inf], np.nan)

    # Strip timezone from tz-aware datetime columns so to_json can format them.
    for col in df.select_dtypes(include=["datetimetz"]).columns:
        df[col] = df[col].dt.tz_convert("UTC").dt.tz_localize(None)

    return df


def _get_df(file_path: str) -> pd.DataFrame:
    global _cached_path, _cached_df
    if _cached_path != file_path:
        raw = pd.read_pickle(file_path)

        if isinstance(raw, pd.DataFrame):
            df = raw
        elif isinstance(raw, (list, tuple)):
            df = pd.DataFrame(raw)
        elif isinstance(raw, dict):
            df = pd.DataFrame(raw)
        else:
            raise ValueError(
                f"Unsupported pickle payload: {type(raw).__name__}. "
                "Expected DataFrame, list, or dict."
            )

        _cached_df = _normalise(df)
        _cached_path = file_path

    return _cached_df  # type: ignore[return-value]


def get_metadata(file_path: str) -> str:
    """Return {columns, rowCount} without serialising any row data."""
    import json
    df = _get_df(file_path)
    return json.dumps(
        {"columns": list(df.columns), "rowCount": int(len(df))}
    )


def load_chunk(file_path: str, offset: int, limit: int) -> str:
    """
    Serialise rows [offset, offset+limit) as a valid JSON array string.

    DataFrame.to_json() correctly converts:
      NaN          → null
      ±Infinity    → null   (replaced by NaN in _normalise)
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
    """Release cached DataFrame (call when dataset is removed by user)."""
    global _cached_path, _cached_df
    _cached_path = None
    _cached_df = None

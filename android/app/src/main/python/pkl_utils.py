"""
pkl_utils.py — Chaquopy module for pickle dataset loading.

Key design decisions:
  - The normalised DataFrame is cached in module-level memory after the first
    read so that get_metadata() + successive load_chunk() calls only read the
    file once. At most ONE file is cached; loading a different path evicts the
    previous entry to cap Python heap usage.
  - get_metadata() never serialises any row data — it only reads column names
    and the row count, which is O(1) on a cached DataFrame and very fast even
    on a cold load of a 100 MB file.
  - load_chunk(offset, limit) serialises only the requested slice. Callers
    (Kotlin/JS) request 5 000-row chunks and yield to the event loop between
    requests, keeping the UI thread free.
"""
import json
import pandas as pd

# Module-level cache: at most one entry to cap Python heap pressure.
_cached_path: str | None = None
_cached_df: "pd.DataFrame | None" = None


def _normalise(df: pd.DataFrame) -> pd.DataFrame:
    """Coerce dtypes to JSON-safe types in-place and return df."""
    # datetime → ISO date string
    for col in df.select_dtypes(include=["datetime64", "datetimetz"]).columns:
        df[col] = df[col].dt.strftime("%Y-%m-%d")
    # Replace NaN / NaT / ±inf with None (→ JSON null)
    df = df.where(pd.notnull(df), None)
    # Convert any remaining non-serialisable dtypes (e.g. pandas NA, Decimal)
    for col in df.columns:
        if df[col].dtype == object:
            df[col] = df[col].apply(lambda v: None if pd.isna(v) if hasattr(v, '__class__') and isinstance(v, float) else False else v)
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
    """
    Return {columns, rowCount} without serialising any row data.
    Safe to call on a 100 MB file — only the header and row count are read.
    """
    df = _get_df(file_path)
    return json.dumps(
        {"columns": list(df.columns), "rowCount": int(len(df))},
        default=str,
    )


def load_chunk(file_path: str, offset: int, limit: int) -> str:
    """
    Serialise rows [offset, offset+limit) as a JSON array string.
    Returns '[]' for out-of-range offsets rather than raising.
    """
    df = _get_df(file_path)
    if offset >= len(df):
        return "[]"
    chunk = df.iloc[offset : offset + limit]
    return json.dumps(chunk.to_dict(orient="records"), default=str)


def evict_cache() -> None:
    """Release cached DataFrame (call when dataset is removed by user)."""
    global _cached_path, _cached_df
    _cached_path = None
    _cached_df = None

"""
pkl_utils.py — Chaquopy Python module for pickle dataset loading.

Loaded via py.getModule("pkl_utils") from PythonModule.kt.
Running as a proper Python module (not via exec()) ensures CPython has a live
stack frame, which is required for any exec/eval inside functions and prevents
the "SystemError: frame does not exist" error that occurs when exec() is called
directly from a Java/Kotlin thread with no Python frame on the stack.
"""
import json
import pandas as pd


def load_as_json(file_path: str) -> str:
    """
    Load a pickle file and serialise its contents as a JSON array string.

    Supported pickle payloads:
      - pandas DataFrame (primary)
      - list of dicts  (converted to DataFrame)
      - plain list     (wrapped per-item)

    Returns:
        A JSON string representing a list of row-dicts.

    Raises:
        ValueError  if the pickle contains an unsupported type.
        Any pandas / pickle exception propagates as-is so the Kotlin
        caller can surface it as a descriptive error message.
    """
    raw = pd.read_pickle(file_path)

    # Normalise to DataFrame
    if isinstance(raw, pd.DataFrame):
        df = raw
    elif isinstance(raw, (list, tuple)):
        df = pd.DataFrame(raw)
    elif isinstance(raw, dict):
        # dict-of-columns format (like pd.DataFrame.to_dict('list'))
        df = pd.DataFrame(raw)
    else:
        raise ValueError(
            f"Unsupported pickle payload type: {type(raw).__name__}. "
            "Expected DataFrame, list, or dict."
        )

    # Convert datetime columns to ISO strings so JSON serialiser doesn't choke
    for col in df.select_dtypes(include=["datetime64", "datetimetz"]).columns:
        df[col] = df[col].dt.strftime("%Y-%m-%d")

    # Replace NaN / NaT / inf with None (valid JSON null)
    df = df.where(pd.notnull(df), None)

    return json.dumps(df.to_dict(orient="records"), default=str)

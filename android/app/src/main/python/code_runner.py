"""
code_runner.py — Chaquopy Python module for sandboxed user-code execution.

Loaded via py.getModule("code_runner") from PythonModule.kt.
Keeping exec() inside a Python function gives it a proper stack frame and
avoids the "SystemError: frame does not exist" that occurs when exec() is
invoked directly from a Java/Kotlin thread.
"""
import io
import sys
import time


def run_code(code: str) -> dict:
    """
    Execute arbitrary Python code in an isolated namespace and capture output.

    Args:
        code: Python source string to execute.

    Returns:
        A dict with keys:
          stdout      (str)  — everything written to print() / sys.stdout
          stderr      (str)  — stderr output + any exception message
          success     (bool) — True only when no exception and no stderr
          executionTime (int) — wall-clock milliseconds
    """
    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()

    old_out, old_err = sys.stdout, sys.stderr
    sys.stdout = stdout_buf
    sys.stderr = stderr_buf

    namespace: dict = {}
    py_error: str | None = None
    start = time.monotonic()

    try:
        # compile() gives a better traceback than passing a raw string to exec()
        compiled = compile(code, "<user_code>", "exec")
        exec(compiled, namespace)
    except Exception as exc:
        py_error = f"{type(exc).__name__}: {exc}"
    finally:
        sys.stdout = old_out
        sys.stderr = old_err
        elapsed_ms = int((time.monotonic() - start) * 1000)

    out = stdout_buf.getvalue()
    err_parts = []
    stderr_val = stderr_buf.getvalue().strip()
    if stderr_val:
        err_parts.append(stderr_val)
    if py_error:
        err_parts.append(py_error)
    err = "\n".join(err_parts)

    return {
        "stdout": out,
        "stderr": err,
        "success": py_error is None and not err,
        "executionTime": elapsed_ms,
    }

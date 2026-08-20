# Weixin FTS Tokenizer

SQLite loadable extension for the original `MMFtsTokenizer` implementation in
Windows Weixin `4.1.9.23`. The extension loads the matching `Weixin.dll`, checks
the callback signatures, and registers the native tokenizer through the FTS5
API.

## Build

```powershell
powershell -ExecutionPolicy Bypass -File native\weixin_fts_tokenizer\build.ps1
```

The build downloads the SQLite public extension headers into the ignored local
`build/` directory, verifies the pinned SHA-256, and writes
`dist/weixin_fts_tokenizer.dll`.

Set `WEIXIN_DLL_PATH` when Weixin is installed elsewhere:

```powershell
$env:WEIXIN_DLL_PATH = '<path-to-weixin-4.1.9.23>\Weixin.dll'
```

Replace `<path-to-weixin-4.1.9.23>` with the matching local installation directory.

## Python

```python
import sqlite3
from contextlib import closing
from pathlib import Path

database = Path('data/db_decrypt/all/message/message_fts.db').resolve()
uri = database.as_uri() + '?mode=ro&immutable=1'

with closing(sqlite3.connect(uri, uri=True)) as connection:
    connection.enable_load_extension(True)
    connection.load_extension('dist/weixin_fts_tokenizer.dll')
    connection.enable_load_extension(False)
    connection.execute('PRAGMA query_only=ON')

    rows = connection.execute(
        "SELECT rowid, acontent FROM message_fts_v4_1 "
        "WHERE message_fts_v4_1 MATCH ? LIMIT 20",
        ('微信',),
    ).fetchall()
```

This extension is version-bound. It rejects a `Weixin.dll` whose callback byte
signatures do not match `4.1.9.23`.

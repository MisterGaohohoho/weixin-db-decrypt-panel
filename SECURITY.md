# Security Policy

## Supported version

Security fixes are applied to the current default branch. This project is version-bound to Windows Weixin `4.1.9.23`; behavior on other client versions is outside the supported scope.

## Reporting a vulnerability

Use the repository host's private vulnerability reporting or security advisory feature. Do not open a public issue containing exploit details, database keys, account IDs, database files, reports, chat content or local filesystem paths.

Before publishing the repository, enable the host's private vulnerability reporting feature. If the chosen host does not provide one, add a monitored private security contact here before accepting external reports.

Include only the minimum synthetic information needed to reproduce the issue:

- affected commit or release
- affected command, API route or component
- reproduction steps using test data
- expected and observed behavior
- security impact

Do not attach a real `keys.json`, `decryption_report.json`, `Weixin.dll` or decrypted database. Maintainers should acknowledge and coordinate disclosure through the private report before details are published.

## Deployment boundary

The visualization panel is designed for a single-user local machine and binds to `127.0.0.1` by default. Exposing the API or Vite server to a LAN or the public Internet is not a supported deployment mode.

## Accidental data disclosure

If a key manifest, database, report or proprietary DLL is committed, treat the repository history and all clones as containing the file. Remove public access, purge the object from Git history, review forks and CI artifacts, and inspect the repository again before restoring access. A later deletion commit does not remove the sensitive object from earlier history.

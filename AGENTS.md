# AGENTS.md

Notes for coding agents and contributors working on sshmonitor.com.

## What this repository is

- `ssh_monitor.sh`: the SSH Monitor Bash script. It reads new SSH log lines (auth.log, secure or the systemd journal), counts failed login attempts and emails a report through the Forward Email API or `sendmail` when a threshold is reached. Test changes with fake logs and stub `curl`, `sendmail` and `journalctl` commands, and run ShellCheck.
- A static site published by GitHub Pages from the root of `main`. There is no CI build: generated files are committed.

## Edit and build

- Page text: `src/pages/*.md` (front matter plus a small Markdown subset: headings, paragraphs, lists, fenced code, tables with an optional `Table: caption` line, and `:::cards` blocks).
- Styles: `src/css/style.css`.
- Build with Node 18 or later, no dependencies: `node scripts/build.js`. It writes `index.html` and `index.md` for each page, `404.html`, `sitemap.xml`, `llms.txt`, `llms-full.txt` and `css/style.min.css`. Commit the source and the output together.
- Static files kept by hand: `robots.txt`, `site.webmanifest`, `.well-known/security.txt`, `images/`, `favicon.ico`, `.nojekyll`, `CNAME`.

## Rules

- Describe the script only from its source. Keep page claims in sync with `ssh_monitor.sh`.
- Link every statistic or third-party fact to a primary source.
- No JavaScript, analytics, cookies or third-party requests on the site.
- Writing style: plain, concise words, second person, no first-person singular, no em dashes, no hype.

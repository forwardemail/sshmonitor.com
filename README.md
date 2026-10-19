# SSH Monitor

Source for [sshmonitor.com](https://sshmonitor.com) and for `ssh_monitor.sh`, a free Bash script from the [Forward Email](https://forwardemail.net) team that emails you when failed SSH logins pass a threshold.

## The script

`ssh_monitor.sh` runs from cron on a Linux server. Each run:

1. Reads the lines added since the last run from `/var/log/auth.log` (Debian, Ubuntu), `/var/log/secure` (Red Hat style systems) or the systemd journal. The read position (inode and byte offset, or a journal cursor) is kept in `/var/lib/ssh_monitor/`, and log rotation and truncation are detected.
2. Counts failed attempts: `Failed <method>` lines, PAM `authentication failure`, `Invalid user` and connections closed before login. Lines are grouped by sshd process so one attempt counts once (the rule is in a comment in the script).
3. Collects successful logins, sorted by time, and flags those outside business hours (08:00 to 18:59 by default) using each login's own timestamp.
4. When the count reaches `FAILED_THRESHOLD` (default 5) and no alert went out in the last `LOCK_DURATION` seconds (default 3600), sends one HTML email through the Forward Email API (`POST https://api.forwardemail.net/v1/emails`, form-encoded) or, with `SEND_METHOD="smtp"`, through `sendmail -t`. If the send fails, the next run retries with the same lines. Attempts during the cooldown go into the next alert.
5. Appends a line to `/var/log/ssh_monitor.log`.

It does not block IP addresses and does not email on each successful login. See the [install guide](https://sshmonitor.com/install/) and the [FAQ](https://sshmonitor.com/faq/) for details.

Quick install:

```bash
sudo curl -fsSL https://sshmonitor.com/ssh_monitor.sh -o /usr/local/bin/ssh_monitor.sh
sudo chmod 700 /usr/local/bin/ssh_monitor.sh
sudo nano /usr/local/bin/ssh_monitor.sh   # set EMAIL_TO, EMAIL_FROM and FORWARD_EMAIL_API_KEY
sudo crontab -e                           # add: */10 * * * * /usr/local/bin/ssh_monitor.sh
```

## The site

The site is static HTML served by GitHub Pages from the root of `main`. There is no CI build, so generated files are committed next to their sources.

| Path | What it is |
| --- | --- |
| `src/pages/*.md` | Page content: front matter (slug, title, description, h1, lead, nav) plus Markdown |
| `src/css/style.css` | Stylesheet source |
| `scripts/build.js` | Build script (Node 18+, no dependencies) |
| `index.html`, `<slug>/index.html` | Generated pages |
| `index.md`, `<slug>/index.md` | Generated Markdown copy of each page |
| `404.html`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, `css/style.min.css` | Generated |
| `robots.txt`, `site.webmanifest`, `.well-known/security.txt`, `images/`, `favicon.ico` | Edited by hand |
| `.nojekyll` | Tells GitHub Pages to serve files as they are (needed for `.well-known/`) |

### Edit a page

1. Edit the Markdown file in `src/pages/`.
2. Run `node scripts/build.js`.
3. Commit the source and the generated files together.

To add a page, create a new file in `src/pages/` with the same front matter fields. The build adds it to the navigation, footer, sitemap and `llms.txt`. Supported Markdown: headings, paragraphs, `-` and `1.` lists, fenced code, tables (with an optional `Table: caption` line above), inline code, bold, links and `:::cards` blocks.

To preview, serve the repository root with any static server, for example `npx http-server . -p 8080`.

### Rules for content

- Describe the script only from its source code.
- Link every statistic or third-party fact to a primary source.
- No JavaScript, analytics, cookies or third-party requests.

## Contributing and security

Open an issue or pull request on [GitHub](https://github.com/forwardemail/sshmonitor.com). Report security problems privately to security@forwardemail.net, as the [Forward Email security policy](https://forwardemail.net/en/security) describes.

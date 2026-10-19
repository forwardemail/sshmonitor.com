# About SSH Monitor

> SSH Monitor is a free script and guide site from the Forward Email team. This page covers who we are, how to reach us and what the site collects.

Source: https://sshmonitor.com/about/

## Who makes SSH Monitor?

The [Forward Email](https://forwardemail.net) team makes SSH Monitor. Forward Email is an open-source email service. Its full source is public at [github.com/forwardemail/forwardemail.net](https://github.com/forwardemail/forwardemail.net), and you can self-host it with Docker. It supports IMAP, POP3, SMTP, CalDAV and CardDAV, and its free plan forwards email for your domain once you set MX and TXT DNS records, with no account needed. The founder was one of the first employees at DuckDuckGo.

## What is the relationship between SSH Monitor and Forward Email?

The script sends its alerts through the [Forward Email API](https://forwardemail.net/en/email-api) by default, so it is also an example of what you can do with that API. You can switch it to `sendmail` and use any mail server. Links on this site to forwardemail.net point to the product, its pricing and its documentation.

## How do you contact the team?

- **Questions and bugs:** open an issue in the [sshmonitor.com repository](https://github.com/forwardemail/sshmonitor.com/issues).
- **Security reports:** email security@forwardemail.net, as the [Forward Email security policy](https://forwardemail.net/en/security) and `https://sshmonitor.com/.well-known/security.txt` describe. Do not post them in public issues.
- **Forward Email support:** see the [Forward Email FAQ](https://forwardemail.net/en/faq).

## Where is the source code?

Both the script and this site live in [github.com/forwardemail/sshmonitor.com](https://github.com/forwardemail/sshmonitor.com). The script is [ssh_monitor.sh](https://github.com/forwardemail/sshmonitor.com/blob/main/ssh_monitor.sh). Every page has an "Edit this page on GitHub" link, and pull requests are welcome.

## Privacy note

This site sets no cookies and runs no JavaScript, analytics or tracking. Pages load no fonts, scripts or images from other domains, so your browser only talks to sshmonitor.com.

Requests to sshmonitor.com pass through Cloudflare, which runs as a CDN and proxy in front of GitHub Pages and processes the IP address of each visitor ([Cloudflare privacy policy](https://www.cloudflare.com/privacypolicy/)). GitHub Pages hosts the files and logs the IP address of each visitor for security purposes ([GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages)).

The script runs on your server and sends data only in the alert email you configure: your host name, the time, failed-attempt counts with IP addresses and user names, and recent logins. It also keeps its read position in `/var/lib/ssh_monitor` on your server. See the [FAQ](https://sshmonitor.com/faq/) for details.

## How is this site built?

Every page is static HTML in the repository, served by GitHub Pages. The page text lives in Markdown files under `src/pages/`, and a small Node script with no dependencies, `scripts/build.js`, turns them into HTML. The same script writes the Markdown copy of each page (for example `/install/index.md`), the sitemap and the `llms.txt` files for AI tools. To change a page, edit its Markdown file, run `node scripts/build.js` and commit the result.

The pages load one stylesheet and no JavaScript, so they work in any browser and with any crawler.

## How does this site check its facts?

Descriptions of the script come from reading its source. Facts about other tools link to their own documentation, such as the [sshd_config manual](https://man.openbsd.org/sshd_config) and the [Fail2Ban README](https://github.com/fail2ban/fail2ban). If you find a mistake, [open an issue](https://github.com/forwardemail/sshmonitor.com/issues) and it will be fixed.

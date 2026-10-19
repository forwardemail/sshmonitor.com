---
slug: /faq/
order: 6
title: SSH Monitor FAQ: Alerts, Limits, Providers and Setup
description: Answers about SSH Monitor: cost, blocking, per-login alerts, Linux and journald support, alert frequency, retries and API keys.
h1: SSH Monitor FAQ
lead: Short answers about what `ssh_monitor.sh` does, where it works and how to tune its alerts.
nav: FAQ
crumb: FAQ
type: FAQPage
llms: Questions and answers about cost, blocking, per-login alerts, supported systems, the journal, counted log lines, alert frequency, rotation, retries, providers, API keys and bug reports.
---

## What is SSH Monitor?

SSH Monitor is a free Bash script, `ssh_monitor.sh`, from the Forward Email team. You run it from cron on a Linux server. Each run reads the new lines in your SSH log, counts failed login attempts and emails you a report through the Forward Email API or `sendmail` when the count reaches a threshold.

## Is SSH Monitor free?

Yes. The script costs nothing and the source is in the [sshmonitor.com repository](https://github.com/forwardemail/sshmonitor.com). Sending the alert through the Forward Email API or SMTP needs a paid Forward Email plan with outbound SMTP set up. If you send through your own mail server with `sendmail`, you need no Forward Email plan.

## Does SSH Monitor block attackers?

No. It only sends alerts. To block addresses, use Fail2Ban, SSHGuard or CrowdSec and turn off password logins. See [SSH Monitor vs Fail2Ban vs Logwatch](/fail2ban-vs-logwatch/).

## Does it send an email for every SSH login?

No. An email goes out only when failed attempts in the new log lines reach `FAILED_THRESHOLD`. Each alert lists the last 5 successful logins from those lines and flags any outside business hours. For a notice on every login, use the `pam_exec` setup in [SSH login alerts by email](/ssh-login-alerts/).

## Is SSH Monitor real time?

No. It runs when cron runs it. With the example schedule of every 10 minutes, you hear about a burst of failures within about 10 minutes, unless an alert already went out in the last `LOCK_DURATION` seconds.

## Which Linux distributions does it work on?

It works on Linux without changes. It reads `/var/log/auth.log` (Debian, Ubuntu) if it exists, then `/var/log/secure` (RHEL, CentOS, Rocky, AlmaLinux, Fedora), then the systemd journal. It reads classic syslog timestamps and ISO 8601 timestamps, and lines from both `sshd` and `sshd-session`. It does not run unchanged on macOS or BSD because it uses GNU `stat -c`.

## Does it work with the systemd journal?

Yes. When no log file exists, as on a fresh Debian 12 install, the script runs `journalctl -u ssh -u sshd` and saves the journal cursor in `/var/lib/ssh_monitor/journal.cursor`. Later runs read only entries after that cursor. The first run reads the last 24 hours (`JOURNAL_SINCE`).

## How often can you get an alert?

At most once per `LOCK_DURATION` (3600 seconds by default), and only when the lines added since the last run hold at least `FAILED_THRESHOLD` failed attempts. Old failures are never reported twice, because the script saves its read position after each run. Attempts that arrive during the cooldown are kept and sent with the next alert.

## What happens when the log rotates?

The script saves the log file's inode and byte offset. If the inode changes, it reads the rest of the old file (now `auth.log.1`) from the saved offset and then the whole new file. If the file shrank, for example after a copytruncate rotation, it reads the file from the start.

## What happens if sending fails?

The run log gets an `Alert email via API failed` (or SMTP) line. The script does not start the cooldown and does not move its read position, so the next run sends the same attempts again, plus any new ones.

## Which failed login lines does it count?

`Failed password`, `Failed publickey`, `Failed keyboard-interactive/pam` and other `Failed <method>` lines, PAM `authentication failure` lines, `Invalid user`, and `Connection closed by` or `Disconnected from` an authenticating or invalid user before login. sshd and PAM often log two or three of these for one attempt, so the script groups lines by sshd process and counts each attempt once:

1. Each `Failed <method>` line counts as one attempt.
2. If a connection has none, each PAM `authentication failure` line counts.
3. If it has neither, one `Invalid user` or closed-before-login line counts once for the connection.

rsyslog lines such as `message repeated 2 times: [ Failed password ... ]` count as 2. This means key-only servers still alert on bots that try user names and disconnect.

## Do you need a Forward Email account?

You need one to send with the Forward Email API, which is the default. You need an API token, a domain with outbound SMTP set up, and a `from` address that is an alias of that domain. To receive alerts at a domain that uses Forward Email for forwarding, the free plan works without an account: you set MX and TXT DNS records.

## Can you use another email provider?

Yes, with the `sendmail` path. Set `SEND_METHOD="smtp"` and configure an MTA such as msmtp or Postfix to relay through your provider's SMTP server. The API path is specific to the Forward Email API.

## Where is the API key stored?

In plain text in the `FORWARD_EMAIL_API_KEY` variable at the top of the script. Keep the file owned by root with mode 700 (`sudo chmod 700 /usr/local/bin/ssh_monitor.sh`) so other users cannot read it.

## What does the off-hours warning mean?

If a successful login in the new lines has a log time before 08:00 or after 18:59, the email lists it under a warning. The check uses each login's own timestamp in server time. Change the hours with `BUSINESS_HOURS_START` and `BUSINESS_HOURS_END`. An off-hours login appears in an alert that failed attempts triggered; on its own it does not send an email.

## How do you change the threshold or the cooldown?

Edit `FAILED_THRESHOLD` (default 5, counted in the lines added since the last run) and `LOCK_DURATION` in seconds (default 3600) at the top of the script. The [install guide](/install/) lists every setting.

## What data does the script send?

Only the email itself: your server's host name, the time, the failed-attempt counts by source IP with the user names tried, recent successful logins (time, user, IP address and method) and the warnings. It goes to the Forward Email API or your `sendmail` relay and then to `EMAIL_TO`. The script sends nothing anywhere else.

## How do you report a bug or a security issue?

Open a [GitHub issue](https://github.com/forwardemail/sshmonitor.com/issues). Report a security problem privately by email to security@forwardemail.net, as the [Forward Email security policy](https://forwardemail.net/en/security) and `https://sshmonitor.com/.well-known/security.txt` describe.

# Free SSH Monitoring with Email Alerts

> SSH Monitor is a free Bash script from the Forward Email team. It reads the new lines in your SSH log, counts failed login attempts and emails you a report when they pass a threshold.

Source: https://sshmonitor.com/

## What is SSH Monitor?

SSH Monitor is `ssh_monitor.sh`, a single Bash script that you run from cron on a Linux server. Each run reads only the SSH log lines added since the last run, counts the failed login attempts in them and collects the successful logins. When the count reaches your threshold (5 by default), the script sends one HTML email through the [Forward Email API](https://forwardemail.net/en/email-api) or through your local `sendmail`.

The script is free. It needs only standard tools (`bash`, `awk`, `sort`, `stat`) plus `curl` or a working `sendmail`. You can read every line of [ssh_monitor.sh on GitHub](https://github.com/forwardemail/sshmonitor.com/blob/main/ssh_monitor.sh) before you install it.

## What does SSH Monitor do?

### Reads only new lines

The script stores the log file's inode and byte offset in `/var/lib/ssh_monitor`, so each run reads only what sshd wrote since the last run. It notices log rotation and truncation.

### Counts failed attempts

It counts `Failed password`, `Failed publickey`, keyboard-interactive failures, PAM `authentication failure` lines, `Invalid user` and connections closed before login, and counts each attempt once.

### Lists recent logins

The alert shows the last 5 successful logins, sorted by time, with the user, source IP and method (password or publickey).

### Flags off-hours logins

Any successful login with a log time before 08:00 or after 18:59 gets its own warning in the email. You can change the hours.

### Limits alert floods

After a sent alert, the script waits `LOCK_DURATION` seconds (3600 by default). Failures during that wait go into the next alert instead of being dropped.

### Retries failed sends

If the API call or `sendmail` fails, the script does not start the cooldown and keeps the read position, so the next run tries again with the same lines.

It works with `/var/log/auth.log` (Debian, Ubuntu), `/var/log/secure` (RHEL, Rocky, AlmaLinux, Fedora) and the systemd journal, in that order, and with both classic syslog and ISO 8601 timestamps.

## What does the alert email look like?

The subject is `SSH Security Alert: <hostname> - <YYYY-MM-DD>`. The body is HTML, and the API also sends a plain-text copy. This is the text of a real alert from a test run, with documentation IP addresses:

```text
SSH Security Monitoring Alert
Server: web-01
Time: <date of the run>
Source: /var/log/auth.log (new lines since the last check)

Failed Login Attempts: 6
  Count  Source IP                               User names tried
      4  203.0.113.5                             root admin
      1  198.51.100.8                            deploy
      1  198.51.100.7                            oracle

Successful Logins (last 5):
2026-03-03 23:05:00  deploy  192.0.2.10  publickey

This is an automated alert from your SSH monitoring system.
WARNING: Successful logins outside business hours (08:00 to 18:59):
2026-03-03 23:05:00  deploy  192.0.2.10
WARNING: High number of failed login attempts detected!
```

Failed attempts are grouped by source IP, with the count and the user names tried from that address. Text taken from the log is HTML-escaped, so a crafted user name cannot change how the email looks.

## What does SSH Monitor not do?

SSH Monitor sends alerts. It does not change anything on your server. Know these limits before you rely on it:

- It does not block IP addresses. Pair it with a blocker such as [Fail2Ban](https://sshmonitor.com/fail2ban-vs-logwatch/) if you want bans.
- Successful logins alone do not trigger an email. They appear in an alert that failed attempts triggered, with off-hours logins flagged. See [SSH login alerts by email](https://sshmonitor.com/ssh-login-alerts/) for an email on every login.
- It is not real time. It runs when cron runs it, every 10 minutes in the example setup.
- It does not record shell sessions, commands or file transfers.

## How do you install it?

Download the script, set your addresses and API key, and add one cron line. The [install guide](https://sshmonitor.com/install/) covers each step, the requirements and troubleshooting.

```bash
sudo curl -fsSL https://sshmonitor.com/ssh_monitor.sh -o /usr/local/bin/ssh_monitor.sh
sudo chmod 700 /usr/local/bin/ssh_monitor.sh
sudo nano /usr/local/bin/ssh_monitor.sh   # set EMAIL_TO, EMAIL_FROM and FORWARD_EMAIL_API_KEY
sudo /usr/local/bin/ssh_monitor.sh && sudo tail -n 3 /var/log/ssh_monitor.log
```

Then add `*/10 * * * * /usr/local/bin/ssh_monitor.sh` to root's crontab with `sudo crontab -e`.

## Why get SSH alerts by email?

Any server with SSH open to the internet receives automated login attempts. The log records them, but nobody reads the log until something goes wrong. An email puts a summary in front of you when failures pile up, and the list of recent successful logins lets you spot a login you do not recognize.

The email is also a copy of the evidence that lives off the server. If someone gets in and edits the log, the alert already in your inbox still shows what the log said at the time. You can read it on your phone, forward it to your team or filter it into a folder.

## Guides on this site

- [Install guide](https://sshmonitor.com/install/): requirements, configuration, cron schedule, testing and troubleshooting.
- [SSH login alerts by email](https://sshmonitor.com/ssh-login-alerts/): what the script reports about successful logins, and how to get an email for every login with PAM.
- [Detect SSH brute-force attempts](https://sshmonitor.com/ssh-brute-force-detection/): read the log, get alerts and block attackers.
- [SSH Monitor vs Fail2Ban vs Logwatch](https://sshmonitor.com/fail2ban-vs-logwatch/): three tools that solve different problems.
- [FAQ](https://sshmonitor.com/faq/): short answers about limits, distributions, providers and alerts.
- [About](https://sshmonitor.com/about/): who makes SSH Monitor, how to contact the team and the privacy note.

## Who makes SSH Monitor?

The [Forward Email](https://forwardemail.net) team publishes SSH Monitor and this site. Forward Email is an open-source email service. The script uses its API to send the alert, and you can also send through any mail server your `sendmail` command reaches. Read more on the [about page](https://sshmonitor.com/about/).

---
slug: /fail2ban-vs-logwatch/
order: 5
title: SSH Monitor vs Fail2Ban vs Logwatch: What Each One Does
description: Fail2Ban bans IPs, Logwatch writes reports and SSH Monitor emails SSH failure alerts. See what each does and how to combine them.
h1: SSH Monitor vs Fail2Ban vs Logwatch
lead: These three tools solve different problems. Fail2Ban blocks IP addresses, Logwatch writes a summary report of many system logs, and SSH Monitor sends an email when failed SSH logins pass a threshold.
nav: Compare
crumb: Fail2Ban and Logwatch comparison
type: WebPage
llms: What Fail2Ban, Logwatch and SSH Monitor each do, a comparison table, and how to run them together.
---

## What is the difference between Fail2Ban, Logwatch and SSH Monitor?

All three read log files, so they get compared, but they do different jobs.

Table: Fail2Ban, Logwatch and SSH Monitor compared
| Feature | Fail2Ban | Logwatch | SSH Monitor |
| --- | --- | --- | --- |
| Main job | Ban IP addresses that fail too often | Summarize many logs in one report | Email an alert when failed SSH logins pass a threshold |
| Changes firewall rules | Yes | No | No |
| Sends email | Optional, with the `action_mw` or `action_mwl` actions | Yes, with `--output mail` | Yes, every alert |
| What it reads | Logs for each enabled jail (sshd, web servers and more) | Many system logs through service filters | The SSH log file or the systemd journal, new lines only |
| When it runs | As a daemon, all the time | When you run it, for a date range such as yesterday | From cron, every 10 minutes in the example setup |
| Setup size | Package plus a `jail.local` file | Package plus options | One Bash script |

## What does Fail2Ban do?

Fail2Ban scans log files such as `/var/log/auth.log` and bans IP addresses with too many failed logins by updating firewall rules for a set time ([Fail2Ban README](https://github.com/fail2ban/fail2ban)). In the stock `jail.conf`, a host is banned after `maxretry = 5` failures within `findtime = 10m`, for `bantime = 10m`.

All jails are off by default, including `sshd`. You turn the SSH jail on in `/etc/fail2ban/jail.local`:

```text
[sshd]
enabled = true
```

Fail2Ban can email you on each ban. The `action_mw` action bans and sends a whois report to `destemail`, and `action_mwl` adds the matching log lines. It sends through `sendmail` by default, so the same msmtp setup from the [install guide](/install/) works for it.

## What does Logwatch do?

Logwatch is a customizable log analysis system. It parses your system logs and creates a report on the areas you choose ([Logwatch on SourceForge](https://sourceforge.net/projects/logwatch/)). You pick a date range such as `yesterday` or `today`, and `--output mail --mailto you@example.com` sends the report by email.

A Logwatch report covers far more than SSH: disk space, package changes, mail server activity and other services, depending on what is installed. It is a daily read, not an alarm.

## What does SSH Monitor do?

SSH Monitor is one Bash script. Each cron run reads the lines added to your SSH log since the last run, counts the failed attempts, and when the count reaches `FAILED_THRESHOLD` it sends one HTML email with the attempts by source IP and the last 5 successful logins, then waits `LOCK_DURATION` seconds before it can send another. It sends through the Forward Email API or `sendmail`. It does not block anything. The [home page](/) lists everything it does and does not do.

## Which one should you use?

- **You want attackers blocked.** Use Fail2Ban, SSHGuard or CrowdSec, and turn off password logins.
- **You want one daily summary of your whole server.** Use Logwatch.
- **You want an email when SSH failures pile up, with no daemon and nothing to learn.** Use SSH Monitor.
- **You want an email for every successful login.** Use a PAM hook. See [SSH login alerts by email](/ssh-login-alerts/).

## Can you run them together?

Yes. They read the same logs and do not conflict. A common setup is Fail2Ban to ban addresses and an email alert so you know an attack is going on.

When Fail2Ban bans an address, that address stops reaching sshd, so it stops adding failed-login lines. SSH Monitor still reports the attempts made before the ban, so you see what Fail2Ban reacted to.

## Other tools you may see compared

- **SSHGuard** protects hosts from brute-force attacks against SSH and other services by reading system logs and blocking repeat offenders ([sshguard.net](https://www.sshguard.net/)).
- **CrowdSec** detects and blocks malicious IPs and shares a community blocklist ([CrowdSec repository](https://github.com/crowdsecurity/crowdsec)).
- **OSSEC** is a host-based intrusion detection system that does log analysis, file integrity checking, rootkit detection, alerting and active response ([OSSEC repository](https://github.com/ossec/ossec-hids)).

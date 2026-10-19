---
slug: /ssh-brute-force-detection/
order: 4
title: Detect SSH Brute-Force Attacks in Your Server Logs
description: Spot SSH brute-force attempts in auth.log or the journal, get an email when they pile up, and stop them with sshd settings.
h1: How to Detect SSH Brute-Force Attempts
lead: An SSH brute-force attempt shows up in your log as many `Failed password` or `Invalid user` lines from a few IP addresses. You can find them with `grep`, get an email with SSH Monitor and stop most of them with sshd settings.
nav: Brute force
crumb: Brute-force detection
type: WebPage
llms: Log lines that show SSH brute-force attempts, commands to count them, how SSH Monitor alerts on them, and sshd settings and tools that block them.
---

## What does an SSH brute-force attempt look like in the log?

sshd writes one line per failed attempt. On Debian and Ubuntu these go to `/var/log/auth.log`. On Red Hat style systems they go to `/var/log/secure`. A password-guessing run looks like this:

```text
Mar  3 10:00:01 web-01 sshd[100]: Failed password for root from 203.0.113.5 port 50001 ssh2
Mar  3 10:00:03 web-01 sshd[100]: Failed password for root from 203.0.113.5 port 50001 ssh2
Mar  3 10:00:05 web-01 sshd[101]: Invalid user admin from 203.0.113.9 port 50002
Mar  3 10:00:05 web-01 sshd[101]: Failed password for invalid user admin from 203.0.113.9 port 50002 ssh2
```

The signs are the same source address over and over, common user names such as `root`, `admin` or `ubuntu`, and attempts a few seconds apart. `Invalid user` means the name does not exist on your server.

When password logins are off, the lines change. Bots then leave lines such as `Connection closed by invalid user admin 203.0.113.9 port 50002 [preauth]` or `Disconnected from authenticating user root ... [preauth]` instead of `Failed password`.

## How do you find failed SSH logins?

Count failed password lines in the current log:

```bash
sudo grep -c "Failed password" /var/log/auth.log
```

List the source addresses with the most failures:

```bash
sudo grep "Failed password" /var/log/auth.log | grep -oE "from [0-9a-fA-F:.]+" | sort | uniq -c | sort -rn | head
```

List the user names attackers tried that do not exist:

```bash
sudo grep "Invalid user" /var/log/auth.log | awk '{print $8}' | sort | uniq -c | sort -rn | head
```

On systems that log only to the systemd journal, read the sshd unit instead. The unit is `ssh` on Debian and Ubuntu and `sshd` on Red Hat style systems:

```bash
sudo journalctl -u ssh -u sshd --since "1 hour ago" | grep "Failed password"
```

## How does SSH Monitor detect brute-force attempts?

SSH Monitor runs these searches for you on a schedule. Each run reads only the lines added since the last run, counts the failed attempts in them and, when the count reaches `FAILED_THRESHOLD` (5 by default), emails you the attempts grouped by source IP with the user names tried. After a sent alert it waits `LOCK_DURATION` seconds (3600 by default), and attempts from that wait go into the next alert. The [install guide](/install/) explains each setting.

What that count means:

- It is a rate: with a 10-minute cron schedule, 5 attempts within about 10 minutes trigger an alert.
- It covers every line shown above: `Failed password`, `Failed publickey`, keyboard-interactive and PAM failures, `Invalid user` and connections closed before login.
- One attempt counts once, even when sshd and PAM log two or three lines for it. The [FAQ](/faq/#which-failed-login-lines-does-it-count) explains the rule.
- It does not block anything. It tells you, and you decide what to do.

Because it also counts `Invalid user` and closed-before-login lines, the alert still works on servers that allow keys only.

## How do you stop SSH brute-force attacks?

The most effective step is to turn off password logins so guessing cannot work. Then cut the noise with sshd limits, a firewall and a blocker. Settings below come from the [sshd_config manual](https://man.openbsd.org/sshd_config).

Table: sshd_config settings that stop password guessing
| Setting in sshd_config | Default | Suggested | Effect |
| --- | --- | --- | --- |
| `PasswordAuthentication` | `yes` | `no` | Only key logins work, so passwords cannot be guessed |
| `KbdInteractiveAuthentication` | `yes` | `no` | Closes the keyboard-interactive path that can also ask for a password |
| `PermitRootLogin` | `prohibit-password` | `no` | Nobody can log in as root over SSH |
| `MaxAuthTries` | `6` | `3` | Fewer attempts per connection |
| `AllowUsers` | all users | your login users | Logins for any other name fail |

Set up and test a key login before you set `PasswordAuthentication no`. Check the file with `sudo sshd -t`, then reload sshd (`sudo systemctl reload ssh` on Debian and Ubuntu, `sshd` on Red Hat style systems). Some distributions also read files in `/etc/ssh/sshd_config.d/`, which can override the main file.

OpenSSH 9.8 and later penalize client addresses that fail to authenticate, and this is on by default ([OpenSSH 9.8 release notes](https://www.openssh.org/txt/release-9.8)). The `PerSourcePenalties` setting controls it.

More layers that help:

- **Firewall allowlist.** If you always connect from known networks, allow port 22 only from them with `ufw`, `firewalld` or `nftables`.
- **Fail2Ban.** Reads the same log and bans addresses with too many failures by changing firewall rules. See [SSH Monitor vs Fail2Ban vs Logwatch](/fail2ban-vs-logwatch/).
- **SSHGuard.** Reads system logs and blocks repeat offenders with one of several firewall backends ([sshguard.net](https://www.sshguard.net/)).
- **CrowdSec.** Detects and blocks malicious IPs and can use a shared community blocklist ([CrowdSec repository](https://github.com/crowdsecurity/crowdsec)).

## Does changing the SSH port help?

Moving SSH off port 22 cuts the number of log lines from scanners that only try the default port. It does not stop anyone who scans all ports. Treat it as a way to quiet the log, and rely on key-only logins for security.

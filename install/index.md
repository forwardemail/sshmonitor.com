# How to Install SSH Monitor

> To install ssh_monitor.sh, download it, set three values, test one run and schedule it with cron. This guide also covers sending setup and troubleshooting.

Source: https://sshmonitor.com/install/

## What do you need?

You need a Linux server with root access and a way to send email. The script finds the SSH log on Debian, Ubuntu and Red Hat style systems without changes.

Table: Requirements for ssh_monitor.sh
| Requirement | Details |
| --- | --- |
| Operating system | Linux. The script uses GNU `stat -c`, so macOS and BSD need changes. |
| Shell and tools | `bash`, `awk` (mawk or gawk), `sed`, `grep`, `sort`, `stat`, `tail`, `head`, `hostname`, `date` |
| Sending | `curl` for the Forward Email API (default), or a working `sendmail` command |
| SSH log | `/var/log/auth.log` (Debian, Ubuntu), then `/var/log/secure` (RHEL, CentOS, Rocky, AlmaLinux, Fedora), then the systemd journal through `journalctl` |
| Scheduler | `cron` (root's crontab) |
| Permissions | Root, to read the SSH log and write `/var/lib/ssh_monitor/` and `/var/log/ssh_monitor.log` |

Debian 12 and later do not install rsyslog by default, so a fresh install may have no `/var/log/auth.log` ([Debian release notes, section 5.1.7](https://www.debian.org/releases/bookworm/amd64/release-notes/ch-information.en.html)). The script then reads the journal for the `ssh` and `sshd` units, so you do not need to install rsyslog.

## How do you set up sending with Forward Email?

The script sends through the Forward Email API by default. The API and SMTP sending need a paid Forward Email plan with outbound SMTP set up for your domain ([plans](https://forwardemail.net/en/pricing)).

1. Add your domain to Forward Email and finish the outbound SMTP setup (DKIM, Return-Path and DMARC records) under My Account, Domains, Settings.
2. Create an alias for the sender, for example `ssh-alerts@yourdomain.com`. The API requires the `from` address to be an alias of your domain.
3. Copy your API token from [My Account, Security](https://forwardemail.net/my-account/security).

To check the token before you install the script, send a test message with the same API call the script uses. The fields are form-encoded, as in the [API reference](https://forwardemail.net/en/email-api):

```bash
curl -sS --fail -X POST https://api.forwardemail.net/v1/emails \
  -u "YOUR_API_TOKEN:" \
  --data-urlencode "from=ssh-alerts@yourdomain.com" \
  --data-urlencode "to=admin@yourdomain.com" \
  --data-urlencode "subject=SSH Monitor test" \
  --data-urlencode "text=It works."
```

The address that receives alerts can be any mailbox. If it is on a domain that uses Forward Email for forwarding only, the free plan covers it: you set MX and TXT DNS records and need no account.

## Step 1: Download the script

Save the script to `/usr/local/bin` and make it readable and executable by root only, since it will hold your API token.

```bash
sudo curl -fsSL https://sshmonitor.com/ssh_monitor.sh -o /usr/local/bin/ssh_monitor.sh
sudo chown root:root /usr/local/bin/ssh_monitor.sh
sudo chmod 700 /usr/local/bin/ssh_monitor.sh
```

The same file is in the [GitHub repository](https://github.com/forwardemail/sshmonitor.com/blob/main/ssh_monitor.sh). Read it before you run it.

## Step 2: Set the configuration

Open the script with `sudo nano /usr/local/bin/ssh_monitor.sh` and edit the variables at the top.

Table: Configuration variables in ssh_monitor.sh
| Variable | Default | What it controls |
| --- | --- | --- |
| `EMAIL_TO` | `admin@yourdomain.com` | Address that receives alerts |
| `EMAIL_FROM` | `ssh-alerts@yourdomain.com` | Sender address, an alias on your Forward Email domain |
| `FORWARD_EMAIL_API_KEY` | `your_api_key_here` | Your Forward Email API token |
| `SEND_METHOD` | `api` | `api` for the Forward Email API, `smtp` for the local `sendmail` command |
| `LOG_FILE` | `/var/log/auth.log` | SSH log to read. If it does not exist, the script uses `/var/log/secure`, then the systemd journal |
| `FAILED_THRESHOLD` | `5` | Failed attempts in the new log lines that trigger an email |
| `ALERT_LOCKFILE` | `/tmp/ssh_monitor_alert.lock` | File whose change time marks the last sent alert |
| `LOCK_DURATION` | `3600` | Seconds to wait after a sent alert before the next one |
| `STATE_DIR` | `/var/lib/ssh_monitor` | Where the read position (`position`) or journal cursor (`journal.cursor`) is stored |
| `RUN_LOG` | `/var/log/ssh_monitor.log` | One line per run |
| `BUSINESS_HOURS_START` | `8` | Logins before this hour get an off-hours warning |
| `BUSINESS_HOURS_END` | `18` | Logins after this hour (from 19:00) get an off-hours warning |
| `JOURNAL_SINCE` | `24 hours ago` | How far back the first journal read goes |

The threshold applies to the lines added since the last run, so with a 10-minute schedule it means 5 failed attempts within about 10 minutes. Raise `FAILED_THRESHOLD` if you only want to hear about larger bursts, and raise `LOCK_DURATION` to get fewer emails. Failures that arrive during the cooldown are not lost: they go into the next alert.

## Step 3: Choose API or sendmail

The API is on by default. To send through a local mail transfer agent instead, set:

```bash
SEND_METHOD="smtp"
```

The sendmail path pipes a message to `sendmail -t`, so you need an MTA such as msmtp or Postfix that relays through an SMTP server. With msmtp on Debian or Ubuntu, install `msmtp msmtp-mta` and create `/etc/msmtprc` (mode 600) with your Forward Email alias and its generated password:

```text
defaults
auth on
tls on
tls_trust_file /etc/ssl/certs/ca-certificates.crt
logfile /var/log/msmtp.log

account forwardemail
host smtp.forwardemail.net
port 465
tls_starttls off
from ssh-alerts@yourdomain.com
user ssh-alerts@yourdomain.com
password YOUR_GENERATED_ALIAS_PASSWORD

account default : forwardemail
```

Forward Email accepts SMTP on port 465 (TLS) and 587 (STARTTLS). The [Forward Email FAQ](https://forwardemail.net/en/faq) has setup guides for sendmail, Exim, msmtp and Postfix.

## Step 4: Run a test

Run the script once by hand and read its log:

```bash
sudo /usr/local/bin/ssh_monitor.sh
sudo tail -n 5 /var/log/ssh_monitor.log
```

You should see `SSH Monitor ran at ... - Found N failed attempts in /var/log/auth.log` (or the file or journal it used). The first run reads the whole current log file, or the last 24 hours of the journal, so it can find older attempts. Later runs read only new lines.

An email goes out only when `N` is at least `FAILED_THRESHOLD` and no alert went out in the last `LOCK_DURATION` seconds. To force a test email, set `FAILED_THRESHOLD=0`, remove the lock file with `sudo rm -f /tmp/ssh_monitor_alert.lock`, run the script, then set the threshold back.

After a send, the log shows `Alert email sent via API` or `Alert email via API failed`. On failure, `curl` prints the HTTP error to the terminal, and the next run sends the same lines again.

## Step 5: Schedule it with cron

Open root's crontab with `sudo crontab -e` and add this line to run the script every 10 minutes:

```text
*/10 * * * * /usr/local/bin/ssh_monitor.sh
```

The schedule sets both how soon you hear about a burst and the time window for `FAILED_THRESHOLD`. If you run it every 5 minutes, consider a lower threshold.

## Step 6: Keep an eye on the run log

The script appends to `/var/log/ssh_monitor.log` on every run, which is at least 144 lines a day at a 10-minute interval. Add it to logrotate if you keep servers for a long time:

```text
/var/log/ssh_monitor.log {
    weekly
    rotate 4
    compress
    missingok
    notifempty
}
```

Save that as `/etc/logrotate.d/ssh_monitor`.

## Troubleshooting

### No email arrives

Check `/var/log/ssh_monitor.log` first. If the failed count is below the threshold, no email is due. If an alert went out in the last hour, the lock file holds the next one back and the attempts wait for the next alert. If the log says the API call failed, test your token with the `curl` command above and confirm that `EMAIL_FROM` is an alias on a domain with outbound SMTP set up.

### no SSH log found

The run log shows this when none of `LOG_FILE`, `/var/log/secure` and `journalctl` exist. Set `LOG_FILE` to the file your syslog daemon writes sshd messages to.

### The count is always 0

Run `sudo tail /var/log/auth.log` (or `sudo journalctl -u ssh -u sshd -n 20`) and check that sshd lines appear there. If they do, check `/var/lib/ssh_monitor/position`: the script only counts lines added after that position. Delete the file to make the next run read the whole log again. See [detecting SSH brute-force attempts](https://sshmonitor.com/ssh-brute-force-detection/) for the log lines the script counts.

### stat: illegal option -- c

You are on macOS or BSD. The script uses GNU `stat -c` for the lock and the read position. It targets Linux.

## How do you uninstall it?

Remove the cron line with `sudo crontab -e`, then delete the files:

```bash
sudo rm -f /usr/local/bin/ssh_monitor.sh /tmp/ssh_monitor_alert.lock /var/log/ssh_monitor.log
sudo rm -rf /var/lib/ssh_monitor
```

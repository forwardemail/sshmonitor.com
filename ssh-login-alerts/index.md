# SSH Login Alerts by Email

> SSH Monitor lists recent successful SSH logins in each alert and flags logins outside business hours, but it only sends an alert when failed attempts reach a threshold. For an email on every login, add a small PAM hook.

Source: https://sshmonitor.com/ssh-login-alerts/

## Does SSH Monitor email you on every SSH login?

No. SSH Monitor sends an email only when the failed attempts in the new log lines reach `FAILED_THRESHOLD`. A successful login on its own does not trigger anything. When an alert does go out, it includes the last 5 successful logins from those lines so you can check them.

If you want to know about each login as it happens, use the PAM setup below. You can run it next to SSH Monitor: one tells you about logins, the other about failed attempts.

## What does SSH Monitor show about successful logins?

The script reads lines like these from the auth log:

```text
Mar  3 10:05:00 web-01 sshd[2211]: Accepted publickey for deploy from 192.0.2.10 port 51000 ssh2: ED25519 SHA256:...
Mar  3 11:42:17 web-01 sshd[2390]: Accepted password for alice from 192.0.2.44 port 52114 ssh2
```

It reads every `Accepted <method>` line (password, publickey, keyboard-interactive/pam), turns the log time into a full date and time, sorts by it and keeps the 5 newest, oldest first. For classic syslog lines, which have no year, it uses the current year, or last year for months later than the current one.

Each login whose log time falls before 08:00 or after 18:59 is also listed under an off-hours warning. You can change the hours with `BUSINESS_HOURS_START` and `BUSINESS_HOURS_END`.

## How do you get an email for every SSH login?

Use `pam_exec`, a standard Linux PAM module that runs a command during login. When sshd opens a session, `pam_exec` runs your script and passes the user and remote host in environment variables such as `PAM_USER`, `PAM_RHOST` and `PAM_TYPE` ([pam_exec manual](https://man7.org/linux/man-pages/man8/pam_exec.8.html)). This needs `UsePAM yes` in `/etc/ssh/sshd_config`, which is the setting on Debian, Ubuntu and Red Hat style systems.

### 1. Create the notify script

Save this as `/usr/local/bin/ssh-login-notify.sh`. It uses the same `sendmail` setup as the [install guide](https://sshmonitor.com/install/), for example msmtp relaying through Forward Email.

```bash
#!/bin/bash
# Email a short notice when an SSH session opens. Called by pam_exec.
[ "$PAM_TYPE" = "open_session" ] || exit 0

{
  echo "Subject: SSH login: $PAM_USER on $(hostname)"
  echo "From: ssh-alerts@yourdomain.com"
  echo "To: admin@yourdomain.com"
  echo
  echo "User: $PAM_USER"
  echo "Remote host: $PAM_RHOST"
  echo "Service: $PAM_SERVICE"
  echo "Time: $(date)"
} | sendmail -t

exit 0
```

Make it executable by root only:

```bash
sudo chown root:root /usr/local/bin/ssh-login-notify.sh
sudo chmod 700 /usr/local/bin/ssh-login-notify.sh
```

### 2. Add the PAM line

Add this line at the end of `/etc/pam.d/sshd`:

```text
session optional pam_exec.so /usr/local/bin/ssh-login-notify.sh
```

`optional` means a failed notification does not block the login. Keep your current SSH session open and test with a second login before you log out, so a mistake cannot lock you out.

### 3. Test it

Log in from another terminal and watch for the email. If it does not, check your MTA log (for msmtp, the `logfile` you set) and run the script by hand with test values:

```bash
sudo PAM_TYPE=open_session PAM_USER=test PAM_RHOST=192.0.2.1 PAM_SERVICE=sshd /usr/local/bin/ssh-login-notify.sh
```

## Things to know about per-login alerts

- `pam_exec` waits for the script to finish, and `sendmail` through msmtp waits for the SMTP server. A slow mail server makes logins slow.
- Automation accounts that log in often (deploy users, backup jobs) will fill your inbox. Add a check such as `[ "$PAM_USER" = "deploy" ] && exit 0` near the top of the script to skip them.
- The notice fires when sshd opens a PAM session, which happens for shell logins and for commands run over SSH.
- `pam_exec` sends the script output to `/dev/null` by default, so the person logging in sees nothing in their terminal.

## Which alert should you use?

Table: SSH Monitor alerts compared with pam_exec login notices
| Question | SSH Monitor | pam_exec login notice |
| --- | --- | --- |
| What triggers an email? | Failed attempts since the last run reach the threshold | Every SSH session that opens |
| When does it run? | On the cron schedule | During login |
| Shows successful logins? | Last 5, inside a failure alert, with off-hours logins flagged | Each one, in its own email |
| Shows failed logins? | Yes, grouped with counts | No |
| Sends through | Forward Email API or sendmail | sendmail |

Most servers benefit from both: per-login notices for accounts that should rarely log in, and SSH Monitor for a summary when [brute-force attempts](https://sshmonitor.com/ssh-brute-force-detection/) pile up.

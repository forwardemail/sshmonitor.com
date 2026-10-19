#!/bin/bash
# SSH Monitor Script
# This script monitors SSH login attempts and sends alerts via Forward Email
# Usage: Place in /usr/local/bin/ and add to crontab to run periodically
# Example crontab entry: */10 * * * * /usr/local/bin/ssh_monitor.sh
# Docs: https://sshmonitor.com/install/
#
# Each run reads only the log lines added since the previous run, counts the
# failed SSH login attempts in them and sends one email when the count
# reaches FAILED_THRESHOLD.

# Configuration
EMAIL_TO="admin@yourdomain.com"
EMAIL_FROM="ssh-alerts@yourdomain.com"
FORWARD_EMAIL_API_KEY="your_api_key_here" # Get from https://forwardemail.net/my-account/security
SEND_METHOD="api" # "api" for the Forward Email API, "smtp" for the local sendmail command
LOG_FILE="/var/log/auth.log" # If missing, /var/log/secure and then the systemd journal are used
FAILED_THRESHOLD=5 # Failed attempts in the new log lines that trigger an alert
ALERT_LOCKFILE="/tmp/ssh_monitor_alert.lock"
LOCK_DURATION=3600 # Don't send another alert for this many seconds
STATE_DIR="/var/lib/ssh_monitor" # Remembers how far the log has been read
RUN_LOG="/var/log/ssh_monitor.log" # One line per run
BUSINESS_HOURS_START=8 # Logins before 08:00 ...
BUSINESS_HOURS_END=18  # ... or after 18:59 get an off-hours warning
JOURNAL_SINCE="24 hours ago" # How far back the first journal read goes

POSITION_FILE="$STATE_DIR/position"     # "<inode> <byte offset>" of the log file
CURSOR_FILE="$STATE_DIR/journal.cursor" # journalctl cursor

mkdir -p "$STATE_DIR"

log_run() {
    echo "$1" >> "$RUN_LOG"
}

# Escape text from the log before it goes into the HTML email
html_escape() {
    sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'
}

# Function to send email via Forward Email HTTP API
# Returns non-zero if the API call fails
send_email_api() {
    local subject="$1"
    local body="$2"

    local text
    # Plain text version of the report (HTML tags removed, entities decoded)
    text=$(echo "$body" | sed -e 's/<[^>]*>//g' -e 's/&lt;/</g' -e 's/&gt;/>/g' -e 's/&amp;/\&/g')

    # Form-encode every field so newlines and quotes in the report are sent safely
    if curl -sS --fail -X POST "https://api.forwardemail.net/v1/emails" \
      -u "$FORWARD_EMAIL_API_KEY:" \
      --data-urlencode "from=$EMAIL_FROM" \
      --data-urlencode "to=$EMAIL_TO" \
      --data-urlencode "subject=$subject" \
      --data-urlencode "html=$body" \
      --data-urlencode "text=$text" \
      -o /dev/null; then
        log_run "Alert email sent via API at $(date)"
        return 0
    fi
    log_run "Alert email via API failed at $(date)"
    return 1
}

# Function to send email via sendmail (SMTP)
# Returns non-zero if sendmail fails
send_email_smtp() {
    local subject="$1"
    local body="$2"

    # printf, not echo -e, so backslashes in log text are not interpreted
    if printf 'Subject: %s\nFrom: %s\nTo: %s\nMIME-Version: 1.0\nContent-Type: text/html; charset=UTF-8\n\n%s\n' \
        "$subject" "$EMAIL_FROM" "$EMAIL_TO" "$body" | sendmail -t; then
        log_run "Alert email sent via SMTP at $(date)"
        return 0
    fi
    log_run "Alert email via SMTP failed at $(date)"
    return 1
}

send_alert() {
    if [ "$SEND_METHOD" = "smtp" ]; then
        send_email_smtp "$1" "$2"
    else
        send_email_api "$1" "$2"
    fi
}

# Check that the cooldown after the last sent alert is over
should_send_alert() {
    if [ -f "$ALERT_LOCKFILE" ]; then
        lockfile_time=$(stat -c %Y "$ALERT_LOCKFILE")
        current_time=$(date +%s)
        elapsed_time=$((current_time - lockfile_time))

        if [ $elapsed_time -lt "$LOCK_DURATION" ]; then
            return 1 # Still in cooldown
        fi
    fi
    return 0
}

# ---------------------------------------------------------------------------
# Read the new log lines
# ---------------------------------------------------------------------------

# Pick the source: LOG_FILE, then /var/log/secure (RHEL, Rocky, AlmaLinux,
# Fedora), then the systemd journal.
if [ -f "$LOG_FILE" ]; then
    SOURCE="file"
elif [ -f /var/log/secure ]; then
    LOG_FILE="/var/log/secure"
    SOURCE="file"
elif command -v journalctl > /dev/null 2>&1; then
    SOURCE="journal"
else
    log_run "SSH Monitor at $(date): no SSH log found ($LOG_FILE, /var/log/secure or journalctl)"
    exit 1
fi

NEW_POSITION=""
NEW_CURSOR=""

if [ "$SOURCE" = "file" ]; then
    SOURCE_NAME="$LOG_FILE"
    read -r current_inode current_size < <(stat -c '%i %s' "$LOG_FILE")
    saved_inode=""
    saved_offset=0
    if [ -f "$POSITION_FILE" ]; then
        read -r saved_inode saved_offset < "$POSITION_FILE"
    fi
    saved_offset=${saved_offset:-0}

    if [ "$saved_inode" = "$current_inode" ] && [ "$saved_offset" -le "$current_size" ]; then
        # Same file: read only the bytes added since the last run
        NEW_LINES=$(tail -c +"$((saved_offset + 1))" "$LOG_FILE" | head -c "$((current_size - saved_offset))")
    else
        # First run, or the file was rotated or truncated: read the whole
        # current file. After a rotation, first read what was added to the
        # old file (now LOG_FILE.1) after the last run.
        NEW_LINES=""
        if [ -n "$saved_inode" ] && [ -f "$LOG_FILE.1" ] && \
           [ "$(stat -c %i "$LOG_FILE.1")" = "$saved_inode" ]; then
            NEW_LINES="$(tail -c +"$((saved_offset + 1))" "$LOG_FILE.1")"$'\n'
        fi
        NEW_LINES+=$(head -c "$current_size" "$LOG_FILE")
    fi
    NEW_POSITION="$current_inode $current_size"
else
    SOURCE_NAME="systemd journal (ssh and sshd units)"
    if [ -s "$CURSOR_FILE" ]; then
        JOURNAL_OUTPUT=$(journalctl -u ssh -u sshd --no-pager -o short-iso --show-cursor \
            --after-cursor "$(cat "$CURSOR_FILE")" 2>/dev/null)
    else
        JOURNAL_OUTPUT=$(journalctl -u ssh -u sshd --no-pager -o short-iso --show-cursor \
            --since "$JOURNAL_SINCE" 2>/dev/null)
    fi
    NEW_CURSOR=$(echo "$JOURNAL_OUTPUT" | sed -n 's/^-- cursor: //p' | tail -n 1)
    NEW_LINES=$(echo "$JOURNAL_OUTPUT" | grep -v '^-- ')
fi

# ---------------------------------------------------------------------------
# Parse the new lines
# ---------------------------------------------------------------------------
# Output, one event per line:  F|time|ip|user|what     (failed attempt)
#                               A|time|ip|user|method   (successful login)
# "time" is "YYYY-MM-DD HH:MM:SS" so events sort by time.
#
# Counting rule, so that one attempt is counted once: sshd and PAM can log
# several lines for a single attempt, for example "Invalid user", a PAM
# "authentication failure" and "Failed password". Lines are grouped by sshd
# process ID (one process per connection), and for each connection:
#   1. every "Failed <method> for ..." line counts as one attempt
#      (password, publickey, keyboard-interactive/pam and others);
#   2. if there are none, every PAM "authentication failure" line counts;
#   3. if there are none of those either, one "Invalid user",
#      "Connection closed by authenticating|invalid user ... [preauth]" or
#      "Disconnected from authenticating|invalid user ... [preauth]" line
#      counts as one attempt for the whole connection.
# rsyslog "message repeated N times: [ Failed ... ]" lines count N times.
parse_lines() {
    awk -v cur_year="$(date +%Y)" -v cur_month="$(date +%-m)" '
    BEGIN {
        split("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec", names, " ")
        for (i = 1; i <= 12; i++) month[names[i]] = i
    }
    # The field after the first field equal to "word", from field "start"
    function after(word, start,   i) {
        for (i = start; i < NF; i++) if ($i == word) return $(i + 1)
        return ""
    }
    # "<Failed|Accepted> <method> for [invalid user] USER from IP"
    function parse_for(i,   j) {
        method = $(i + 1)
        j = i + 2
        if ($j != "for") return 0
        j++
        if ($j == "invalid" && $(j + 1) == "user") j += 2
        user = $j
        ip = after("from", j)
        return 1
    }
    {
        # Timestamp: ISO 8601 (rsyslog high precision, journalctl short-iso)
        # or classic syslog ("Mar  3 10:00:01", year taken from today)
        if ($1 ~ /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T/) {
            ts = substr($1, 1, 10) " " substr($1, 12, 8)
            prog = $3; first = 4
        } else if ($1 in month) {
            m = month[$1]
            y = (m > cur_month) ? cur_year - 1 : cur_year
            ts = sprintf("%04d-%02d-%02d %s", y, m, $2, $3)
            prog = $5; first = 6
        } else next

        if (prog !~ /^sshd/) next
        pid = prog
        gsub(/[^0-9]/, "", pid)
        repeat = 1
        if ($first == "message" && $(first + 1) == "repeated") {
            repeat = $(first + 2) + 0
            first += 5
        }
        msg = $first
        user = ""; ip = ""; method = ""

        if (msg == "Failed") {
            if (!parse_for(first)) next
            for (r = 0; r < repeat; r++)
                failed[pid] = failed[pid] "F|" ts "|" ip "|" user "|failed " method "\n"
        } else if (msg == "Accepted") {
            if (!parse_for(first)) next
            print "A|" ts "|" ip "|" user "|" method
        } else if (index($0, "): authentication failure;")) {
            for (i = first; i <= NF; i++) {
                if ($i ~ /^rhost=/) ip = substr($i, 7)
                if ($i ~ /^user=/) user = substr($i, 6)
            }
            pam[pid] = pam[pid] "F|" ts "|" ip "|" user "|PAM authentication failure\n"
        } else if (msg == "Invalid" && $(first + 1) == "user") {
            # "Invalid user NAME from IP port N" (NAME can be empty)
            user = ($(first + 2) == "from") ? "" : $(first + 2)
            ip = after("from", first)
            if (!(pid in other)) other[pid] = "F|" ts "|" ip "|" user "|invalid user\n"
        } else if (/\[preauth\]/ && (/Connection closed by (authenticating|invalid) user / || \
                                     /Disconnected from (authenticating|invalid) user /)) {
            # "... authenticating user NAME IP port N [preauth]"
            for (i = first; i < NF; i++) if ($i == "user") break
            user = $(i + 1); ip = $(i + 2)
            if (!(pid in other)) other[pid] = "F|" ts "|" ip "|" user "|closed before login\n"
        }
    }
    END {
        for (p in failed) printf "%s", failed[p]
        for (p in pam) if (!(p in failed)) printf "%s", pam[p]
        for (p in other) if (!(p in failed) && !(p in pam)) printf "%s", other[p]
    }'
}

EVENTS=$(printf '%s\n' "$NEW_LINES" | parse_lines | sort -t '|' -k2,2)
FAILED_EVENTS=$(printf '%s\n' "$EVENTS" | grep '^F|')
LOGIN_EVENTS=$(printf '%s\n' "$EVENTS" | grep '^A|')
FAILED_COUNT=$(printf '%s' "$FAILED_EVENTS" | grep -c .)

# Failed attempts grouped by source IP: count, IP, user names tried
FAILED_ATTEMPTS=$(printf '%s\n' "$FAILED_EVENTS" | awk -F'|' 'NF >= 4 {
        ip = ($3 == "") ? "unknown" : $3
        n[ip]++
        if ($4 != "" && index(" " users[ip] " ", " " $4 " ") == 0) users[ip] = users[ip] " " $4
    }
    END { for (ip in n) printf "%7d  %-39s %s\n", n[ip], ip, substr(users[ip], 2) }' | sort -nr | html_escape)

# Last 5 successful logins, oldest first: time, user, IP, method
SUCCESSFUL_LOGINS=$(printf '%s\n' "$LOGIN_EVENTS" | \
    awk -F'|' 'NF >= 5 { print $2 "  " $4 "  " $3 "  " $5 }' | tail -n 5 | html_escape)

# Successful logins outside business hours, using each login's own time
OFF_HOURS_LOGINS=$(printf '%s\n' "$LOGIN_EVENTS" | \
    awk -F'|' -v start="$BUSINESS_HOURS_START" -v end="$BUSINESS_HOURS_END" 'NF >= 5 {
        hour = substr($2, 12, 2) + 0
        if (hour < start || hour > end) print $2 "  " $4 "  " $3
    }' | html_escape)

# ---------------------------------------------------------------------------
# Build and send the alert
# ---------------------------------------------------------------------------

# Get hostname for the alert
HOSTNAME=$(hostname)

# Prepare email content with HTML formatting
EMAIL_SUBJECT="SSH Security Alert: $HOSTNAME - $(date +%Y-%m-%d)"
EMAIL_BODY="<h2>SSH Security Monitoring Alert</h2>
<p><strong>Server:</strong> $HOSTNAME</p>
<p><strong>Time:</strong> $(date)</p>
<p><strong>Source:</strong> $SOURCE_NAME (new lines since the last check)</p>

<h3>Failed Login Attempts: $FAILED_COUNT</h3>
<pre>  Count  Source IP                               User names tried
$FAILED_ATTEMPTS</pre>

<h3>Successful Logins (last 5):</h3>
<pre>${SUCCESSFUL_LOGINS:-None}</pre>

<p>This is an automated alert from your SSH monitoring system.</p>"

# Add warning for logins outside business hours
if [ -n "$OFF_HOURS_LOGINS" ]; then
    EMAIL_BODY="$EMAIL_BODY
<p style='color: red;'><strong>WARNING:</strong> Successful logins outside business hours ($(printf '%02d' "$BUSINESS_HOURS_START"):00 to $(printf '%02d' "$BUSINESS_HOURS_END"):59):</p>
<pre>$OFF_HOURS_LOGINS</pre>"
fi

# Save the read position unless these lines still need to be reported
SAVE_POSITION=true

if [ "$FAILED_COUNT" -ge "$FAILED_THRESHOLD" ]; then
    EMAIL_BODY="$EMAIL_BODY
<p style='color: red;'><strong>WARNING:</strong> High number of failed login attempts detected!</p>"

    if ! should_send_alert; then
        SAVE_POSITION=false # In cooldown: include these lines in the next alert
    elif send_alert "$EMAIL_SUBJECT" "$EMAIL_BODY"; then
        touch "$ALERT_LOCKFILE" # Start the cooldown only after a successful send
    else
        SAVE_POSITION=false # Send failed: retry with the same lines on the next run
    fi
fi

if [ "$SAVE_POSITION" = true ]; then
    if [ -n "$NEW_POSITION" ]; then
        echo "$NEW_POSITION" > "$POSITION_FILE"
    fi
    if [ -n "$NEW_CURSOR" ]; then
        echo "$NEW_CURSOR" > "$CURSOR_FILE"
    fi
fi

# Always log activity summary
log_run "SSH Monitor ran at $(date) - Found $FAILED_COUNT failed attempts in $SOURCE_NAME"

exit 0

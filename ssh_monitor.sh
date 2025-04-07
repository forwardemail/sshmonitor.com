#!/bin/bash
# SSH Monitor Script
# This script monitors SSH login attempts and sends alerts via Forward Email
# Usage: Place in /usr/local/bin/ and add to crontab to run periodically
# Example crontab entry: */10 * * * * /usr/local/bin/ssh_monitor.sh

# Configuration
EMAIL_TO="admin@yourdomain.com"
EMAIL_FROM="ssh-alerts@yourdomain.com"
FORWARD_EMAIL_API_KEY="your_api_key_here" # Get from https://forwardemail.net/my-account/security
LOG_FILE="/var/log/auth.log"
FAILED_THRESHOLD=5 # Number of failed attempts to trigger alert
ALERT_LOCKFILE="/tmp/ssh_monitor_alert.lock"
LOCK_DURATION=3600 # Don't send another alert for this many seconds

# Function to send email via Forward Email HTTP API
send_email_api() {
    local subject="$1"
    local body="$2"

    curl -X POST "https://api.forwardemail.net/v1/emails" \
      -H "Content-Type: application/json" \
      -u "$FORWARD_EMAIL_API_KEY:" \
      -d '{
        "from": "'"$EMAIL_FROM"'",
        "to": "'"$EMAIL_TO"'",
        "subject": "'"$subject"'",
        "html": "'"$body"'",
        "text": "'"$body"'"
      }'

    echo "Alert email sent via API at $(date)" >> /var/log/ssh_monitor.log
}

# Function to send email via sendmail (SMTP)
send_email_smtp() {
    local subject="$1"
    local body="$2"

    echo -e "Subject: $subject\nFrom: $EMAIL_FROM\nTo: $EMAIL_TO\n\n$body" | \
    sendmail -t

    echo "Alert email sent via SMTP at $(date)" >> /var/log/ssh_monitor.log
}

# Check if we should send an alert (avoid alert flooding)
should_send_alert() {
    if [ -f "$ALERT_LOCKFILE" ]; then
        lockfile_time=$(stat -c %Y "$ALERT_LOCKFILE")
        current_time=$(date +%s)
        elapsed_time=$((current_time - lockfile_time))

        if [ $elapsed_time -lt $LOCK_DURATION ]; then
            return 1 # Don't send alert
        fi
    fi

    # Create or update lockfile
    touch "$ALERT_LOCKFILE"
    return 0 # Send alert
}

# Get hostname for the alert
HOSTNAME=$(hostname)

# Check for failed SSH login attempts in the last 10 minutes
TIMEFRAME="10 minutes ago"
FAILED_ATTEMPTS=$(grep "Failed password" $LOG_FILE | grep -i ssh | grep -v "grep" | awk '{print $1,$2,$3,$11}' | sort | uniq -c | sort -nr)
FAILED_COUNT=$(echo "$FAILED_ATTEMPTS" | wc -l)

# Check for successful logins
SUCCESSFUL_LOGINS=$(grep "Accepted password\|Accepted publickey" $LOG_FILE | grep -i ssh | grep -v "grep" | awk '{print $1,$2,$3,$9,$11}' | sort | tail -5)

# Check for unusual login times (outside business hours 8am-6pm)
HOUR=$(date +%H)
UNUSUAL_TIME=false
if [ "$HOUR" -lt 8 ] || [ "$HOUR" -gt 18 ]; then
    UNUSUAL_TIME=true
fi

# Prepare email content with HTML formatting
EMAIL_SUBJECT="SSH Security Alert: $HOSTNAME - $(date +%Y-%m-%d)"
EMAIL_BODY="<h2>SSH Security Monitoring Alert</h2>
<p><strong>Server:</strong> $HOSTNAME</p>
<p><strong>Time:</strong> $(date)</p>
<p><strong>Alert Type:</strong> Periodic SSH Activity Report</p>

<h3>Failed Login Attempts (Last 10 minutes):</h3>
<pre>$FAILED_ATTEMPTS</pre>

<h3>Recent Successful Logins:</h3>
<pre>$SUCCESSFUL_LOGINS</pre>

<p>This is an automated alert from your SSH monitoring system.</p>
<p>For more information, please check the server logs at $LOG_FILE</p>"

# Add warning for unusual login times
if [ "$UNUSUAL_TIME" = true ]; then
    EMAIL_BODY="$EMAIL_BODY
<p style='color: red;'><strong>WARNING:</strong> Login activity detected outside normal business hours!</p>"
fi

# Add warning for high number of failed attempts
if [ $FAILED_COUNT -ge $FAILED_THRESHOLD ]; then
    EMAIL_BODY="$EMAIL_BODY
<p style='color: red;'><strong>WARNING:</strong> High number of failed login attempts detected!</p>"

    # Send alert if threshold exceeded and we're not in lockout period
    if should_send_alert; then
        # Uncomment one of these methods based on your preference:
        send_email_api "$EMAIL_SUBJECT" "$EMAIL_BODY"
        # send_email_smtp "$EMAIL_SUBJECT" "$EMAIL_BODY"
    fi
fi

# Always log activity summary
echo "SSH Monitor ran at $(date) - Found $FAILED_COUNT failed attempts" >> /var/log/ssh_monitor.log

exit 0

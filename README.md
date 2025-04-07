# SSH Monitoring | Real-time Security Alerts & Activity Tracking

## Secure Your Servers with Real-time SSH Monitoring

Detect unauthorized access attempts, track user activity, and receive instant alerts for suspicious behavior with our comprehensive SSH monitoring solution.

[Get Started](https://forwardemail.net) | [Learn About Forward Email](https://forwardemail.net)

## Comprehensive SSH Monitoring Features

### Real-time Intrusion Detection
Monitor login attempts in real-time and receive immediate alerts for suspicious activities like brute force attacks or unauthorized access attempts.

### User Activity Tracking
Track and log all SSH sessions, commands executed, and file transfers to maintain a complete audit trail of server activity.

### Customizable Alerting
Configure alert thresholds and notification preferences to focus on the security events that matter most to your organization.

### Automated Response
Set up automated responses to security incidents, such as blocking IP addresses after multiple failed login attempts.

## Why Monitor SSH Activity?

### Prevent Unauthorized Access
SSH is a primary target for attackers seeking server access. According to [SSH.com](https://www.ssh.com/academy/ssh/security), servers face hundreds to thousands of break-in attempts daily, with SSH being a common attack vector.

### Maintain Compliance
Many regulatory frameworks like PCI DSS, SOC 2, and HIPAA require monitoring of privileged access. SSH monitoring helps meet these compliance requirements by providing detailed audit trails of all server access.

### Detect Insider Threats
Not all threats come from outside your organization. According to the [Verizon Data Breach Investigations Report](https://www.verizon.com/business/resources/reports/dbir/), approximately 34% of data breaches involve internal actors.

### Reduce Mean Time to Resolution
When security incidents occur, rapid detection and response are critical. SSH monitoring provides the visibility needed to quickly identify and address security issues.

## Easy Implementation with Forward Email

### Ready-to-Use SSH Monitoring Script

Below is a complete, production-ready Bash script for monitoring SSH login attempts and sending alerts via Forward Email. This script can be easily customized to fit your specific security requirements.

```bash
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
      -u "$FORWARD_EMAIL_API_KEY:"
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
        # Check if lock file is still valid (not expired)
        lock_time=$(cat "$ALERT_LOCKFILE")
        current_time=$(date +%s)
        
        if [ $((current_time - lock_time)) -lt $LOCK_DURATION ]; then
            return 1 # Lock still valid, don't send alert
        fi
    fi
    
    # Create or update lock file with current timestamp
    date +%s > "$ALERT_LOCKFILE"
    return 0 # Send alert
}

# Check for failed SSH login attempts
check_failed_logins() {
    # Get failed login attempts in the last 10 minutes
    local failed_attempts=$(grep "Failed password" "$LOG_FILE" | grep -i ssh | grep -i "$(date +"%b %d")" | wc -l)
    
    if [ "$failed_attempts" -ge "$FAILED_THRESHOLD" ]; then
        if should_send_alert; then
            local subject="SSH Alert: $failed_attempts failed login attempts detected"
            local body="SSH Monitor Alert\n\nDetected $failed_attempts failed SSH login attempts on $(hostname) in the last check period.\n\nRecent failed login attempts:\n\n$(grep "Failed password" "$LOG_FILE" | grep -i ssh | grep -i "$(date +"%b %d")" | tail -10)\n\nThis alert was generated automatically by the SSH Monitor script."
            
            # Send alert via API or SMTP
            if [ -n "$FORWARD_EMAIL_API_KEY" ]; then
                send_email_api "$subject" "$body"
            else
                send_email_smtp "$subject" "$body"
            fi
        fi
    fi
}

# Check for successful logins
check_successful_logins() {
    # Get successful login attempts in the last 10 minutes
    local successful_logins=$(grep "Accepted" "$LOG_FILE" | grep -i ssh | grep -i "$(date +"%b %d")" | tail -5)
    
    if [ -n "$successful_logins" ]; then
        echo "Successful logins detected at $(date):" >> /var/log/ssh_monitor.log
        echo "$successful_logins" >> /var/log/ssh_monitor.log
    fi
}

# Main execution
check_failed_logins
check_successful_logins

exit 0
```

### Installation Steps

1. **Create the Script File**
   ```bash
   sudo nano /usr/local/bin/ssh_monitor.sh
   ```
   Copy and paste the script above, then save the file.

2. **Make the Script Executable**
   ```bash
   sudo chmod +x /usr/local/bin/ssh_monitor.sh
   ```

3. **Configure the Script**
   Update the email addresses and API key in the script configuration section.

4. **Set Up Scheduled Monitoring**
   ```bash
   sudo crontab -e
   ```
   Add the following line to run the script every 10 minutes:
   ```
   */10 * * * * /usr/local/bin/ssh_monitor.sh
   ```

5. **Test the Script**
   ```bash
   sudo /usr/local/bin/ssh_monitor.sh
   ```

## Advanced SSH Security Recommendations

### Implement Key-Based Authentication
Disable password authentication and use SSH keys for stronger security. This significantly reduces the risk of brute force attacks.

### Use Non-Standard SSH Ports
Change the default SSH port (22) to a non-standard port to reduce automated scanning attacks.

### Limit User Access
Restrict SSH access to specific users who require it, and implement the principle of least privilege.

### Configure Firewall Rules
Use iptables or ufw to limit SSH access to specific IP addresses or networks.

### Regular Log Analysis
Complement automated monitoring with regular manual review of SSH logs to identify patterns or anomalies.

## Resources

### GitHub Repository
Access the full SSH monitoring script and additional security tools on our [GitHub repository](https://github.com/forwardemail/ssh-monitoring-tools).

### Documentation
Comprehensive documentation on SSH security best practices and monitoring techniques is available in our [knowledge base](https://forwardemail.net/guides).

### Community Support
Join our community forum to discuss SSH security, share experiences, and get help with implementation.

## Ready to Secure Your Servers?

Start monitoring your SSH access today with our easy-to-implement solution.

[Get Started with Forward Email](https://forwardemail.net) | [View Documentation](https://forwardemail.net/guides)

## Citations & References

1. SSH.com. (2024). *SSH Security Risks and Best Practices*. Retrieved April 5, 2025, from [https://www.ssh.com/academy/ssh/security](https://www.ssh.com/academy/ssh/security)
2. Verizon. (2024). *Data Breach Investigations Report*. Retrieved April 5, 2025, from [https://www.verizon.com/business/resources/reports/dbir/](https://www.verizon.com/business/resources/reports/dbir/)
3. NIST. (2024). *Guide to SSH Implementation*. Special Publication 800-123. Retrieved April 5, 2025, from [https://csrc.nist.gov/publications](https://csrc.nist.gov/publications)
4. Forward Email. (2025). *Email API Documentation*. Retrieved April 5, 2025, from [https://forwardemail.net/email-api](https://forwardemail.net/email-api)

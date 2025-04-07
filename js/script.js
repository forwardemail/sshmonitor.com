document.addEventListener('DOMContentLoaded', function() {
    // Handle smooth scrolling for anchor links
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    if (anchorLinks && anchorLinks.length > 0) {
        for (const link of anchorLinks) {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                var targetId = this.getAttribute('href');
                if (targetId === '#') return;
                
                var targetElement = document.querySelector(targetId);
                if (targetElement) {
                    window.scrollTo({
                        top: targetElement.offsetTop - 80,
                        behavior: 'smooth'
                    });
                }
            });
        }
    }

    // Initialize scroll event handler
    window.addEventListener('scroll', updateActiveNavLink);
    
    // Initialize animations
    initAnimations();
    
    // Initialize syntax highlighting
    initSyntaxHighlighting();
    
    // Initialize demo button
    initDemoButton();
});

function updateActiveNavLink() {
    var sections = document.querySelectorAll('section[id]');
    var navLinks = document.querySelectorAll('nav ul li a');
    
    if (!sections || sections.length === 0 || !navLinks || navLinks.length === 0) return;
    
    let currentSection = '';
    
    for (const section of sections) {
        var sectionTop = section.offsetTop - 100;
        var sectionHeight = section.offsetHeight;
        var sectionId = section.getAttribute('id');
        
        if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
            currentSection = sectionId;
        }
    }
    
    for (const link of navLinks) {
        link.classList.remove('active');
        if (link.getAttribute('href') === '#' + currentSection) {
            link.classList.add('active');
        }
    }
}

function initAnimations() {
    // Animate elements on scroll
    window.addEventListener('scroll', function() {
        var animatedElements = document.querySelectorAll('.feature-card, .benefit-card, .workflow-step, .use-case');
        
        if (!animatedElements || animatedElements.length === 0) return;
        
        for (const element of animatedElements) {
            var elementTop = element.getBoundingClientRect().top;
            var triggerPoint = window.innerHeight / 1.3;
            
            if (elementTop < triggerPoint) {
                element.classList.add('animate');
            }
        }
    });
    
    // Add hover effects to cards
    var cards = document.querySelectorAll('.feature-card, .benefit-card');
    
    if (!cards || cards.length === 0) return;
    
    for (const card of cards) {
        card.addEventListener('mouseenter', function() {
            this.classList.add('hover');
        });
        
        card.addEventListener('mouseleave', function() {
            this.classList.remove('hover');
        });
    }
}

function initSyntaxHighlighting() {
    var codeBlocks = document.querySelectorAll('pre code');
    
    if (!codeBlocks || codeBlocks.length === 0) return;
    
    for (const codeBlock of codeBlocks) {
        var codeContent = codeBlock.innerHTML;
        
        // Highlight comments
        let highlightedCode = codeContent.replace(/(#.+)$/gm, '<span class="comment">$1</span>');
        
        // Highlight strings
        highlightedCode = highlightedCode.replace(/('.*?'|".*?")/g, '<span class="string">$1</span>');
        
        // Highlight keywords
        var keywords = ['import', 'from', 'def', 'return', 'if', 'else', 'for', 'while', 'class', 'try', 'except', 'finally'];
        
        for (const keyword of keywords) {
            var pattern = new RegExp(`\\b${keyword}\\b`, 'g');
            highlightedCode = highlightedCode.replace(pattern, `<span class="keyword">${keyword}</span>`);
        }
        
        // Highlight functions
        highlightedCode = highlightedCode.replace(/(\w+)(\()/g, '<span class="function">$1</span>$2');
        
        codeBlock.innerHTML = highlightedCode;
    }
    
    // Add syntax highlighting styles
    var styleElement = document.createElement('style');
    styleElement.textContent = `
        .comment { color: #6a9955; }
        .string { color: #ce9178; }
        .keyword { color: #569cd6; }
        .function { color: #dcdcaa; }
    `;
    document.head.appendChild(styleElement);
}

function initDemoButton() {
    var demoButton = document.createElement('button');
    demoButton.className = 'demo-button';
    demoButton.textContent = 'Simulate SSH Alert';
    
    var emailAlertsSection = document.getElementById('email-alerts');
    if (emailAlertsSection) {
        var container = emailAlertsSection.querySelector('.container');
        if (container) {
            container.appendChild(demoButton);
            demoButton.style.display = 'block';
            demoButton.style.margin = '40px auto 0';
            demoButton.style.padding = '12px 24px';
            demoButton.style.backgroundColor = 'var(--primary-color)';
            demoButton.style.color = 'white';
            demoButton.style.border = 'none';
            demoButton.style.borderRadius = '4px';
            demoButton.style.fontWeight = 'bold';
            demoButton.style.cursor = 'pointer';
            
            demoButton.addEventListener('click', showSSHAlert);
        }
    }
}

function showSSHAlert() {
    var alerts = [
        {
            title: 'SSH Login Failure Alert',
            message: 'Multiple failed SSH login attempts detected for user "root" from IP 192.168.1.254 on server web-01.',
            type: 'critical'
        },
        {
            title: 'Unusual SSH Access Time',
            message: 'SSH login detected outside normal working hours from IP 10.0.0.15 for user "admin" on server db-02.',
            type: 'warning'
        },
        {
            title: 'SSH Brute Force Attack',
            message: 'Potential brute force attack detected: 25+ failed SSH login attempts in the last 5 minutes from IP 203.0.113.42.',
            type: 'security'
        },
        {
            title: 'Unauthorized SSH Command',
            message: 'User "developer" executed potentially dangerous command: "chmod -R 777 /var/www/" on production server.',
            type: 'critical'
        },
        {
            title: 'New SSH Key Added',
            message: 'New SSH key added to authorized_keys file for user "deploy" on server app-03.',
            type: 'warning'
        }
    ];
    
    var randomAlert = alerts[Math.floor(Math.random() * alerts.length)];
    
    var alertElement = document.createElement('div');
    alertElement.className = `ssh-alert ${randomAlert.type}`;
    alertElement.innerHTML = `
        <div class="ssh-alert-header">
            <h4>${randomAlert.title}</h4>
            <span class="ssh-alert-time">${new Date().toLocaleTimeString()}</span>
        </div>
        <p>${randomAlert.message}</p>
        <div class="ssh-alert-footer">
            <span class="ssh-alert-server">Server: web-01</span>
            <button class="ssh-alert-dismiss">Dismiss</button>
        </div>
    `;
    
    // Style the alert
    alertElement.style.position = 'fixed';
    alertElement.style.bottom = alertElement.style.right = '20px';
    alertElement.style.width = '350px';
    alertElement.style.padding = '15px';
    alertElement.style.backgroundColor = 'white';
    alertElement.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.2)';
    alertElement.style.borderRadius = '4px';
    alertElement.style.borderLeft = '5px solid var(--primary-color)';
    alertElement.style.transform = 'translateX(400px)';
    alertElement.style.transition = 'transform 0.3s ease';
    alertElement.style.zIndex = '1000';
    
    // Style the header
    var alertHeader = alertElement.querySelector('.ssh-alert-header');
    alertHeader.style.display = 'flex';
    alertHeader.style.justifyContent = 'space-between';
    alertHeader.style.alignItems = 'center';
    alertHeader.style.marginBottom = '10px';
    
    var alertTitle = alertElement.querySelector('h4');
    alertTitle.style.margin = '0';
    alertTitle.style.color = 'var(--primary-color)';
    
    var alertTime = alertElement.querySelector('.ssh-alert-time');
    alertTime.style.fontSize = '12px';
    alertTime.style.color = 'var(--text-light)';
    
    // Style the footer
    var alertFooter = alertElement.querySelector('.ssh-alert-footer');
    alertFooter.style.display = 'flex';
    alertFooter.style.justifyContent = 'space-between';
    alertFooter.style.alignItems = 'center';
    alertFooter.style.marginTop = '10px';
    
    var alertServer = alertElement.querySelector('.ssh-alert-server');
    alertServer.style.fontSize = '12px';
    alertServer.style.color = 'var(--text-light)';
    
    var dismissButton = alertElement.querySelector('.ssh-alert-dismiss');
    dismissButton.style.padding = '5px 10px';
    dismissButton.style.backgroundColor = 'var(--light-color)';
    dismissButton.style.border = 'none';
    dismissButton.style.borderRadius = '4px';
    dismissButton.style.cursor = 'pointer';
    
    // Add to DOM and animate in
    document.body.appendChild(alertElement);
    setTimeout(() => alertElement.style.transform = 'translateX(0)', 100);
    
    // Add dismiss functionality
    dismissButton.addEventListener('click', function() {
        alertElement.style.transform = 'translateX(400px)';
        setTimeout(() => {
            if (document.body.contains(alertElement)) {
                alertElement.remove();
            }
        }, 300);
    });
    
    // Auto-dismiss after 6 seconds
    setTimeout(() => {
        if (document.body.contains(alertElement)) {
            alertElement.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (document.body.contains(alertElement)) {
                    alertElement.remove();
                }
            }, 300);
        }
    }, 6000);
}

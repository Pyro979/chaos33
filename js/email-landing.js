// Google tag (gtag.js) - script tag should be in HTML head
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-M8BX2363LX');

// Capture and track UTM parameters
(function() {
    const urlParams = new URLSearchParams(window.location.search);
    const utmSource = urlParams.get('utm_source');
    const utmMedium = urlParams.get('utm_medium');
    const utmCampaign = urlParams.get('utm_campaign');
    
    if (utmSource || utmMedium || utmCampaign) {
        // Track page view with UTM parameters
        gtag('event', 'page_view', {
            'utm_source': utmSource || '(not set)',
            'utm_medium': utmMedium || '(not set)',
            'utm_campaign': utmCampaign || '(not set)',
            'page_location': window.location.href
        });
        
        // Also set as custom dimensions if you have them configured
        // gtag('config', 'G-M8BX2363LX', {
        //   'custom_map': {
        //     'dimension1': 'utm_source',
        //     'dimension2': 'utm_medium',
        //     'dimension3': 'utm_campaign'
        //   },
        //   'utm_source': utmSource,
        //   'utm_medium': utmMedium,
        //   'utm_campaign': utmCampaign
        // });
    }
})();

// Track form submissions
function trackEmailSignup() {
    if (typeof gtag !== "function") return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const utmSource = urlParams.get('utm_source') || '(direct)';
    const utmMedium = urlParams.get('utm_medium') || '(none)';
    const utmCampaign = urlParams.get('utm_campaign') || 'email_signup';
    
    const form = document.querySelector('.formkit-form');
    if (form) {
        const submitButton = form.querySelector('button[data-element="submit"]');
        if (submitButton) {
            submitButton.addEventListener('click', function() {
                gtag('event', 'email_signup', {
                    'event_category': 'engagement',
                    'event_label': 'email_landing_page',
                    'utm_source': utmSource,
                    'utm_medium': utmMedium,
                    'utm_campaign': utmCampaign
                });
            });
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackEmailSignup);
} else {
    trackEmailSignup();
}

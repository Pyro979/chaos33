/**
 * Updates ConvertKit form submit button text (per-page CTA) and tracks form submit clicks for analytics.
 * Used by pnp-email and convention landing pages.
 */

(function() {
    'use strict';

    var isConvention = typeof window !== 'undefined' && window.location.pathname.indexOf('/convention') !== -1;
    var buttonLabel = isConvention ? 'Submit Name & Sign Up' : 'Sign up to download Print-n-Play';

    function attachTracking(button) {
        if (button.dataset.gaBound === 'true') return;
        button.dataset.gaBound = 'true';

        button.addEventListener('click', function() {
            if (typeof gtag !== 'function') return;
            var urlParams = new URLSearchParams(window.location.search);
            gtag('event', 'email_signup', {
                event_category: 'engagement',
                event_label: isConvention ? 'convention_landing_page' : 'pnp_email_landing_page',
                utm_source: urlParams.get('utm_source') || '(direct)',
                utm_medium: urlParams.get('utm_medium') || '(none)',
                utm_campaign: urlParams.get('utm_campaign') || (isConvention ? 'convention_signup' : 'pnp_email_signup')
            });
        });
    }

    function updateButtonText() {
        var buttons = document.querySelectorAll('button[data-element="submit"].formkit-submit');

        buttons.forEach(function(button) {
            var textSpan = button.querySelector('span');
            if (textSpan && textSpan.textContent.trim() === 'Subscribe') {
                textSpan.textContent = buttonLabel;
            }
            attachTracking(button);
        });
    }
    
    // Try to update immediately if DOM is already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateButtonText);
    } else {
        updateButtonText();
    }
    
    // Also watch for dynamically loaded forms (ConvertKit forms load asynchronously)
    // Use MutationObserver to catch when the form is added to the DOM
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) { // Element node
                        // Check if this node or its children contain the button
                        const button = node.querySelector ? node.querySelector('button[data-element="submit"].formkit-submit') : null;
                        if (button || (node.matches && node.matches('button[data-element="submit"].formkit-submit'))) {
                            updateButtonText();
                        }
                    }
                });
            }
        });
    });
    
    // Start observing the document body for changes
    if (document.body) {
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    } else {
        // If body doesn't exist yet, wait for it
        document.addEventListener('DOMContentLoaded', function() {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        });
    }
    
    // Fallback: try again after a short delay to catch late-loading forms
    setTimeout(updateButtonText, 1000);
    setTimeout(updateButtonText, 3000);
})();

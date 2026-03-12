/**
 * Updates ConvertKit form submit button text (per-page CTA), tracks form submit
 * clicks for analytics, and on /convention/ pre-fills the Convention field.
 * Can be included on any page that uses ConvertKit forms.
 */

(function() {
    'use strict';

    var CONVENTION_DEFAULT = 'level_up_2026';

    function getPath() {
        return typeof window !== 'undefined' ? (window.location.pathname || '') : '';
    }

    function getButtonLabel() {
        var path = getPath();
        if (path.indexOf('convention') !== -1) return 'Submit Name & Sign Up';
        if (path.indexOf('passnplay-email') !== -1) return 'Sign up to get free Pass & Play';
        if (path.indexOf('pnp-email') !== -1) return 'Sign up to download free Print-n-Play';
        if (path.indexOf('email') !== -1) return 'Join the Chaos List';
        return 'Join the Chaos List';
    }

    function getEventLabel() {
        var path = getPath();
        if (path.indexOf('convention') !== -1) return 'convention_landing_page';
        if (path.indexOf('passnplay-email') !== -1) return 'passnplay_email_landing_page';
        if (path.indexOf('pnp-email') !== -1) return 'pnp_email_landing_page';
        if (path.indexOf('email') !== -1) return 'email_landing_page';
        return null;
    }

    function getUtmCampaign() {
        var path = getPath();
        if (path.indexOf('convention') !== -1) return 'convention_signup';
        if (path.indexOf('passnplay-email') !== -1) return 'passnplay_email_signup';
        if (path.indexOf('pnp-email') !== -1) return 'pnp_email_signup';
        if (path.indexOf('email') !== -1) return 'email_signup';
        return 'email_signup';
    }

    function prefillConventionField() {
        var path = getPath();
        if (path.indexOf('convention') === -1) return;
        var input = document.querySelector('input[name="' + CSS.escape('fields[con]') + '"]');
        if (input && !input.value) {
            input.value = CONVENTION_DEFAULT;
            var wrapper = input.closest('.formkit-field') || input.parentElement;
            if (wrapper) wrapper.style.display = 'none';
            console.log('[convention form] Pre-filled Convention field with:', CONVENTION_DEFAULT);
        } else if (path.indexOf('convention') !== -1) {
            console.log('[convention form] Convention field not set. Found input:', !!input, 'has value:', input ? !!input.value : 'N/A');
        }
    }

    function attachTracking(button, index) {
        if (button.dataset.gaBound === 'true') return;
        button.dataset.gaBound = 'true';

        button.addEventListener('click', function() {
            if (typeof gtag !== 'function') return;

            var path = getPath();
            var eventLabel = getEventLabel();

            if (eventLabel !== null) {
                var urlParams = new URLSearchParams(window.location.search);
                gtag('event', 'email_signup', {
                    event_category: 'engagement',
                    event_label: eventLabel,
                    utm_source: urlParams.get('utm_source') || '(direct)',
                    utm_medium: urlParams.get('utm_medium') || '(none)',
                    utm_campaign: urlParams.get('utm_campaign') || getUtmCampaign()
                });
            } else {
                var location = index === 0 ? 'hero' : 'footer';
                gtag('event', 'join_list_click', { location: location });
            }
        });
    }

    function updateButtonText() {
        var buttons = document.querySelectorAll('button[data-element="submit"].formkit-submit');
        var label = getButtonLabel();

        buttons.forEach(function(button, index) {
            var textSpan = button.querySelector('span');
            if (textSpan && textSpan.textContent.trim() === 'Subscribe') {
                textSpan.textContent = label;
            }
            attachTracking(button, index);
        });
    }

    function runFormUpdates() {
        updateButtonText();
        prefillConventionField();
    }
    
    // Try to update immediately if DOM is already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runFormUpdates);
    } else {
        runFormUpdates();
    }
    
    // Also watch for dynamically loaded forms (ConvertKit forms load asynchronously)
    // Use MutationObserver to catch when the form is added to the DOM
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) { // Element node
                        var hasButton = node.querySelector ? node.querySelector('button[data-element="submit"].formkit-submit') : null;
                        var hasConField = node.querySelector ? node.querySelector('input[name="' + CSS.escape('fields[con]') + '"]') : null;
                        if (hasButton || hasConField || (node.matches && node.matches('button[data-element="submit"].formkit-submit'))) {
                            runFormUpdates();
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
    
    // Fallback: try again after delays to catch late-loading ConvertKit form
    setTimeout(runFormUpdates, 1000);
    setTimeout(runFormUpdates, 3000);
    setTimeout(runFormUpdates, 6000);
})();

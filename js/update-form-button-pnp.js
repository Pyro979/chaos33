/**
 * Updates ConvertKit form submit button text to "Sign up to download Print-n-Play PDFs"
 * For the pnp-email landing page
 */

(function() {
    'use strict';
    
    function updateButtonText() {
        // Find the submit button with the specific structure
        const submitButton = document.querySelector('button[data-element="submit"].formkit-submit');
        
        if (submitButton) {
            // Find the span inside the button that contains the text
            const textSpan = submitButton.querySelector('span');
            
            if (textSpan && textSpan.textContent.trim() === 'Subscribe') {
                textSpan.textContent = 'Sign up to download Print-n-Play';
            }
        }
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

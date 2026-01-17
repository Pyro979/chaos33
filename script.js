// Wait for DOM to be fully loaded
document.addEventListener("DOMContentLoaded", function () {
  // Set current year in footer
  const yearElement = document.getElementById("current-year");
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  // Card Demo Data
  // Data is loaded from data.js (generated from source JSON files)
  // The following variables are expected to be in global scope: chaosPrompts, chaosDuels, duelTriggers, wordList
  
  // Validate that data.js was loaded
  if (typeof chaosPrompts === 'undefined' || typeof chaosDuels === 'undefined' || 
      typeof duelTriggers === 'undefined' || typeof wordList === 'undefined') {
    console.error('Error: data.js must be loaded before script.js. Please ensure data.js is included in index.html before script.js');
    return;
  }

  // Card Demo Functionality
  const chaosCard = document.getElementById("chaos-card");
  const wordCard = document.getElementById("word-card");
  const chaosTitle = document.getElementById("chaos-title");
  const chaosDescription = document.getElementById("chaos-description");
  const wordText = document.getElementById("word-text");
  const chaosLabel = chaosCard ? chaosCard.querySelector(".card-label") : null;
  const wordLabel = wordCard ? wordCard.querySelector(".card-label") : null;

  // Track flip interval (10 seconds normally, 33 seconds after manual flip)
  let flipInterval = 10000; // 10 seconds in milliseconds
  let autoFlipInterval = null;
  let progress = 0;
  let progressInterval = null;
  let startProgressTimer = null; // Will be defined in the card section

  // Track flip count to alternate between regular and duel flips
  let flipCount = 0;

  // Shuffle arrays for duels and Duel Cues
  function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Shuffle duels and ensure no consecutive category blitz/scavenge
  function prepareDuels() {
    let shuffled = shuffleArray(chaosDuels);
    let attempts = 0;
    const maxAttempts = 100;

    // Check for consecutive category blitz/scavenge and reshuffle if needed
    while (attempts < maxAttempts) {
      let hasConsecutive = false;
      for (let i = 0; i < shuffled.length - 1; i++) {
        const current = shuffled[i].title;
        const next = shuffled[i + 1].title;
        const isCurrentBlitz = current.includes("Category Blitz");
        const isCurrentScavenge = current.includes("Scavenge");
        const isNextBlitz = next.includes("Category Blitz");
        const isNextScavenge = next.includes("Scavenge");

        if (
          (isCurrentBlitz || isCurrentScavenge) &&
          (isNextBlitz || isNextScavenge)
        ) {
          hasConsecutive = true;
          break;
        }
      }

      if (!hasConsecutive) {
        break;
      }

      shuffled = shuffleArray(chaosDuels);
      attempts++;
    }

    return shuffled;
  }

  const shuffledDuels = prepareDuels();
  const shuffledDuelTriggers = shuffleArray(duelTriggers);
  let duelIndex = 0;
  let duelTriggerIndex = 0;

  function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  function getNextDuel() {
    const duel = shuffledDuels[duelIndex % shuffledDuels.length];
    duelIndex++;
    return duel;
  }

  function getNextDuelTrigger() {
    const trigger =
      shuffledDuelTriggers[duelTriggerIndex % shuffledDuelTriggers.length];
    duelTriggerIndex++;
    return trigger;
  }

  // Circular progress indicator for flip timer
  const flipTimer = document.getElementById("flip-timer");
  const timerCircle = flipTimer
    ? flipTimer.querySelector(".timer-circle")
    : null;
  const timerCountdown = document.getElementById("timer-countdown");

  function updateProgress(progress, totalSeconds) {
    if (timerCircle) {
      // stroke-dashoffset goes from 100 (empty) to 0 (full)
      const offset = 100 - progress;
      timerCircle.style.strokeDashoffset = offset;
    }
    // Update countdown
    if (timerCountdown) {
      const secondsRemaining = Math.ceil(
        (100 - progress) / (100 / totalSeconds)
      );
      timerCountdown.textContent =
        secondsRemaining > 0 ? secondsRemaining : totalSeconds;
    }
  }

  function resetProgress(totalSeconds) {
    if (timerCircle) {
      timerCircle.style.strokeDashoffset = 100;
    }
    if (timerCountdown) {
      timerCountdown.textContent = totalSeconds.toString();
    }
  }

  function flipCards(isManual = false) {
    // Only flip if cards exist (they're in the hero section)
    if (!chaosCard || !wordCard) return;

    // If manual flip, switch to 33 seconds and track the event
    if (isManual) {
      flipInterval = 33000; // Switch to 33 seconds
      // Track the manual flip event
      if (typeof gtag === "function") {
        gtag("event", "card_demo_flip");
      }
      // Restart the auto-flip interval with new timing
      if (autoFlipInterval) {
        clearInterval(autoFlipInterval);
      }
      autoFlipInterval = setInterval(function () {
        flipCards();
      }, flipInterval);
    }

    // Start the timer immediately when flip begins
    if (typeof startProgressTimer === "function") {
      startProgressTimer();
    }

    // Check if this will be a duel flip to swap header color during flip
    const willBeDuelFlip = flipCount % 2 === 1;
    if (willBeDuelFlip && chaosLabel) {
      chaosLabel.classList.add("duel-label");
      if (wordLabel) wordLabel.classList.add("duel-label");
    } else if (!willBeDuelFlip && chaosLabel) {
      chaosLabel.classList.remove("duel-label");
      if (wordLabel) wordLabel.classList.remove("duel-label");
    }

    // Add flipping class for animation
    chaosCard.classList.add("flipping");
    wordCard.classList.add("flipping");

    // Wait for card to flip halfway (when it's facing away), then update content
    setTimeout(function () {
      // Alternate between regular flips and duel/Duel Cue flips
      const isDuelFlip = flipCount % 2 === 1;

      if (isDuelFlip) {
        // Use duel and Duel Cue
        const duel = getNextDuel();
        const duelTrigger = getNextDuelTrigger();

        // Add duel class to chaos card for styling
        chaosCard.classList.add("is-duel");

        // Update labels (class already added before flip)
        if (chaosLabel) {
          chaosLabel.textContent = "Duel";
        }
        if (wordLabel) {
          wordLabel.textContent = "Duel Cue";
        }

        // Update chaos card with duel
        if (chaosTitle) {
          // Add line break after colon if present
          let titleText = duel.title;
          if (titleText.includes(":")) {
            titleText = titleText.replace(":", ":<br>");
            chaosTitle.innerHTML = titleText;
          } else {
            chaosTitle.textContent = titleText;
          }
          chaosTitle.classList.add("duel-title");
        }
        if (chaosDescription) {
          // Handle newlines by converting \n to <br>
          // Handle markdown bold by converting **text** to <strong>text</strong>
          let descriptionWithBreaks = duel.description.replace(/\\n/g, "<br>");
          descriptionWithBreaks = descriptionWithBreaks.replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
          );
          chaosDescription.innerHTML = descriptionWithBreaks;
        }

        // Update word card with Duel Cue
        if (wordText) wordText.textContent = duelTrigger;
      } else {
        // Remove duel class if it exists
        chaosCard.classList.remove("is-duel");

        // Update labels back to normal (class already removed before flip)
        if (chaosLabel) {
          chaosLabel.textContent = "Chaos Prompt";
        }
        if (wordLabel) {
          wordLabel.textContent = "Word";
        }

        // Use regular chaos prompt and word
        const randomChaos = getRandomItem(chaosPrompts);
        const randomWord = getRandomItem(wordList);

        // Update chaos card
        if (chaosTitle) {
          chaosTitle.textContent = randomChaos.title;
          chaosTitle.classList.remove("duel-title");
        }
        if (chaosDescription) {
          chaosDescription.textContent = randomChaos.description;
        }

        // Update word card
        if (wordText) wordText.textContent = randomWord;
      }

      flipCount++;
    }, 600); // Half of the 1200ms transition duration

    // Remove flipping class after animation completes to reset for next flip
    setTimeout(function () {
      chaosCard.classList.remove("flipping");
      wordCard.classList.remove("flipping");
    }, 1200); // Full transition duration
  }

  // Auto-flip cards with progress indicator
  if (chaosCard && wordCard) {
    startProgressTimer = function () {
      // Clear any existing interval
      if (progressInterval) {
        clearInterval(progressInterval);
      }

      // Get current interval in seconds
      const currentSeconds = flipInterval / 1000;

      // Reset progress
      progress = 0;
      updateProgress(0, currentSeconds);

      // Calculate update interval (100ms for smooth animation)
      const updateInterval = 100;
      const totalUpdates = flipInterval / updateInterval;

      // Start new interval
      progressInterval = setInterval(function () {
        progress += 100 / totalUpdates;
        updateProgress(progress, currentSeconds);

        if (progress >= 100) {
          clearInterval(progressInterval);
          progressInterval = null;
        }
      }, updateInterval);
    };

    // Make cards clickable for manual flip
    chaosCard.addEventListener("click", function () {
      flipCards(true);
    });

    wordCard.addEventListener("click", function () {
      flipCards(true);
    });

    // Flip immediately on load (timer will start after flip completes)
    flipCards();

    // Flip every 10 seconds initially (will change to 33 after manual flip)
    autoFlipInterval = setInterval(function () {
      flipCards();
    }, flipInterval);
  }

  // Hamburger menu toggle
  const menuToggle = document.getElementById("menu-toggle");
  const navLinks = document.getElementById("nav-links");

  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", function () {
      const isActive = menuToggle.classList.toggle("active");
      navLinks.classList.toggle("active");
      // Update ARIA attributes for accessibility
      menuToggle.setAttribute("aria-expanded", isActive ? "true" : "false");
    });

    // Close menu when clicking on a link
    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", function () {
        menuToggle.classList.remove("active");
        navLinks.classList.remove("active");
        menuToggle.setAttribute("aria-expanded", "false");
      });
    });

    // Close menu when clicking outside
    document.addEventListener("click", function (event) {
      if (
        !menuToggle.contains(event.target) &&
        !navLinks.contains(event.target)
      ) {
        menuToggle.classList.remove("active");
        navLinks.classList.remove("active");
        menuToggle.setAttribute("aria-expanded", "false");
      }
    });

    // Close menu when scrolling
    window.addEventListener("scroll", function () {
      if (menuToggle.classList.contains("active")) {
        menuToggle.classList.remove("active");
        navLinks.classList.remove("active");
        menuToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  // Smooth scroll for anchor links (fallback if CSS doesn't work)
  // Note: Modern browsers support CSS scroll-behavior: smooth, but this is a fallback
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      const href = this.getAttribute("href");
      // Skip if it's just "#" or empty
      if (href === "#" || href === "#top") {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        window.history.pushState(null, "", "#top");
        return;
      }

      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        // Update URL hash
        window.history.pushState(null, "", href);
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  // Track external link clicks (Kickstarter, etc.)
  document.querySelectorAll('a[href*="kickstarter.com"]').forEach((link) => {
    link.addEventListener('click', function(e) {
      if (typeof gtag === "function") {
        const url = this.getAttribute('href');
        const urlParams = new URLSearchParams(url.split('?')[1] || '');
        
        gtag('event', 'kickstarter_click', {
          'event_category': 'outbound',
          'event_label': 'kickstarter_link',
          'transport_type': 'beacon',
          'utm_source': urlParams.get('utm_source') || '(not set)',
          'utm_medium': urlParams.get('utm_medium') || '(not set)',
          'utm_campaign': urlParams.get('utm_campaign') || 'kickstarter'
        });
      }
    });
  });
});

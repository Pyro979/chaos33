/**
 * Mobile visual explainer: 7 PNG slides, auto-advance every 33s (no visible timer),
 * preload slides 2–7 after slide 1 loads; auto-advance stops permanently on any click.
 * First user interaction (mobile) sends interacted_with_mobile_rules to GA4 + FB pixel.
 */
function initVisualExplainerCarousel() {
  const root = document.querySelector(".visual-explainer-carousel");
  if (!root) return;

  const imgBtn = root.querySelector(".rules-carousel-image-btn");
  const img = document.getElementById("rules-carousel-img");
  const prevBtns = root.querySelectorAll(".rules-carousel-prev");
  const nextBtns = root.querySelectorAll(".rules-carousel-next");
  const currentEls = root.querySelectorAll(".rules-carousel-current");

  if (
    !imgBtn ||
    !img ||
    prevBtns.length === 0 ||
    nextBtns.length === 0 ||
    currentEls.length === 0
  ) {
    return;
  }

  const TOTAL = 7;
  const SLIDE_PREFIX =
    root.getAttribute("data-rules-slide-prefix") ||
    "images/mobile_rules/instructions_multi_page_";
  const SLIDE_MS = 33000;

  let index = 0;
  let autoAdvanceTimeoutId = null;
  let userStoppedAuto = false;
  let hasStartedAuto = false;
  let preloaded = false;
  let mobileRulesAnalyticsSent = false;

  const mq = window.matchMedia("(max-width: 767px)");

  function trackMobileRulesInteractionOnce() {
    if (mobileRulesAnalyticsSent || !mq.matches) return;
    mobileRulesAnalyticsSent = true;
    if (typeof gtag === "function") {
      gtag("event", "interacted_with_mobile_rules", {
        event_category: "visual_explainer",
      });
    }
    if (typeof fbq === "function") {
      fbq("trackCustom", "interacted_with_mobile_rules");
    }
  }

  function slideUrl(i) {
    return `${SLIDE_PREFIX}${i + 1}.png`;
  }

  function updateSlide() {
    img.src = slideUrl(index);
    img.alt = `How to play: visual instructions, step ${index + 1} of ${TOTAL}`;
    const n = String(index + 1);
    currentEls.forEach(function (el) {
      el.textContent = n;
    });
  }

  function preloadRemaining() {
    if (preloaded) return;
    preloaded = true;
    for (let i = 1; i < TOTAL; i++) {
      const pre = new Image();
      pre.src = slideUrl(i);
    }
  }

  function clearAutoAdvance() {
    if (autoAdvanceTimeoutId !== null) {
      clearTimeout(autoAdvanceTimeoutId);
      autoAdvanceTimeoutId = null;
    }
  }

  function stopAutoAdvance() {
    userStoppedAuto = true;
    clearAutoAdvance();
  }

  function scheduleAutoAdvance() {
    if (userStoppedAuto || !mq.matches) return;
    clearAutoAdvance();
    autoAdvanceTimeoutId = setTimeout(function () {
      autoAdvanceTimeoutId = null;
      index = (index + 1) % TOTAL;
      updateSlide();
      if (!userStoppedAuto && mq.matches) {
        scheduleAutoAdvance();
      }
    }, SLIDE_MS);
  }

  function goNext() {
    index = (index + 1) % TOTAL;
    updateSlide();
  }

  function goPrev() {
    index = (index - 1 + TOTAL) % TOTAL;
    updateSlide();
  }

  function onUserInteract() {
    trackMobileRulesInteractionOnce();
    stopAutoAdvance();
  }

  prevBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      onUserInteract();
      goPrev();
    });
  });

  nextBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      onUserInteract();
      goNext();
    });
  });

  imgBtn.addEventListener("click", function () {
    onUserInteract();
    goNext();
  });

  img.addEventListener("load", function () {
    if (index === 0) preloadRemaining();
  });
  if (img.complete) preloadRemaining();

  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (
          entry.isIntersecting &&
          mq.matches &&
          !hasStartedAuto &&
          !userStoppedAuto
        ) {
          hasStartedAuto = true;
          scheduleAutoAdvance();
        }
      });
    },
    { threshold: 0.2 }
  );
  observer.observe(root);

  mq.addEventListener("change", function () {
    if (!mq.matches) {
      clearAutoAdvance();
    }
  });
}

// Wait for DOM to be fully loaded
document.addEventListener("DOMContentLoaded", function () {
  // Set current year in footer
  const yearElement = document.getElementById("current-year");
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  initVisualExplainerCarousel();

  // Card Demo Data
  // Data is loaded from data.js (generated from source JSON files)
  // The following variables are expected to be in global scope: chaosPrompts, chaosDuels, duelTriggers, wordList
  
  // Validate that data.js was loaded
  if (typeof chaosPrompts === 'undefined' || typeof chaosDuels === 'undefined' || 
      typeof duelTriggers === 'undefined' || typeof wordList === 'undefined' ||
      typeof goblinModeCards === 'undefined') {
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
  const chaosBackImg = chaosCard ? chaosCard.querySelector(".card-back img") : null;
  const wordBackImg = wordCard ? wordCard.querySelector(".card-back img") : null;
  const imageBase = (window.location.pathname.indexOf("pnp-email") !== -1 || window.location.pathname.indexOf("passnplay-email") !== -1) ? "../images/" : "images/";

  // Track flip interval (10 seconds normally, 33 seconds after manual flip)
  let flipInterval = 10000; // 10 seconds in milliseconds
  let autoFlipInterval = null;
  let progress = 0;
  let progressInterval = null;
  let startProgressTimer = null; // Will be defined in the card section

  // Track flip count to alternate between regular and duel flips
  let flipCount = 0;

  // Shuffle arrays for duels and Showdown! (duel trigger) cues
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

  const shuffledGoblinMode = shuffleArray(goblinModeCards);
  let goblinModeIndex = 0;

  function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  const CUE_TO_SLUG = {
    'Give clues in this voice': 'voice',
    'Give clues while doing this': 'doing',
    'Give clues with this attitude': 'attitude',
    'Give clues by describing': 'describing',
    'Give clues using only': 'using-only',
    'Every clue must follow this format': 'format',
    'Give clues but never say': 'never-say',
    'Give clues as if you are': 'as-if',
    'Give clues as if sharing a': 'as-if',
    'Give clues as if leading a': 'as-if',
    'Give clues as if narrating a': 'as-if',
    'Give clues as if giving a': 'as-if',
    'Give clues as if doing': 'as-if',
    'Give clues as if delivering a': 'as-if'
  };

  function getCueSlug(cue) {
    if (!cue || typeof cue !== 'string') return 'unknown';
    const slug = CUE_TO_SLUG[cue.trim()];
    return slug || 'unknown';
  }

  function updateChaosCueChip(prompt) {
    const chipEl = document.getElementById('chaos-cue-chip');
    if (!chipEl) return;
    if (!prompt || !prompt.cue) {
      chipEl.style.display = 'none';
      chipEl.textContent = '';
      return;
    }
    chipEl.textContent = prompt.cue + '...';
    chipEl.className = 'chaos-cue-chip chaos-cue-chip--' + getCueSlug(prompt.cue);
    chipEl.style.display = '';
  }

  function getNextDuel() {
    const duel = shuffledDuels[duelIndex % shuffledDuels.length];
    duelIndex++;
    return duel;
  }

  function getNextGoblinMode() {
    const card = shuffledGoblinMode[goblinModeIndex % shuffledGoblinMode.length];
    goblinModeIndex++;
    return card;
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
      if (typeof fbq === "function") {
        fbq("trackCustom", "CardDemoFlip");
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

    // Determine next flip type: 0 = regular, 1 = duel, 2 = goblin mode
    const nextFlipType = flipCount % 3;
    const willBeDuelFlip = nextFlipType === 1;
    const willBeGoblinFlip = nextFlipType === 2;

    // Set label classes before flip so CSS transition animations fire correctly
    if (willBeDuelFlip) {
      if (chaosLabel) { chaosLabel.classList.add("duel-label"); chaosLabel.classList.remove("goblin-label"); }
      if (wordLabel) { wordLabel.classList.add("duel-label"); wordLabel.classList.remove("goblin-label"); }
    } else if (willBeGoblinFlip) {
      if (chaosLabel) { chaosLabel.classList.add("goblin-label"); chaosLabel.classList.remove("duel-label"); }
      if (wordLabel) { wordLabel.classList.add("goblin-label"); wordLabel.classList.remove("duel-label"); }
    } else {
      if (chaosLabel) { chaosLabel.classList.remove("duel-label"); chaosLabel.classList.remove("goblin-label"); }
      if (wordLabel) { wordLabel.classList.remove("duel-label"); wordLabel.classList.remove("goblin-label"); }
    }

    // Set card back images before flip so the correct back is visible during the animation
    if (willBeDuelFlip) {
      if (chaosBackImg) {
        chaosBackImg.src = imageBase + "gobbo/gobbo_duel_nohood.png";
        chaosBackImg.alt = "Goblin mascot – Duel";
      }
      if (wordBackImg) {
        wordBackImg.src = imageBase + "gobbo/gobbo_duel_nohood.png";
        wordBackImg.alt = "Goblin mascot – Duel";
      }
    } else if (willBeGoblinFlip) {
      // Goblin Mode uses word card backs on both cards
      if (chaosBackImg) {
        chaosBackImg.src = imageBase + "gobbo/gobbo_word_nohood.png";
        chaosBackImg.alt = "Goblin mascot – Word";
      }
      if (wordBackImg) {
        wordBackImg.src = imageBase + "gobbo/gobbo_word_nohood.png";
        wordBackImg.alt = "Goblin mascot – Word";
      }
    } else {
      if (chaosBackImg) {
        chaosBackImg.src = imageBase + "gobbo/gobbo_chaos_nohood.png";
        chaosBackImg.alt = "Goblin mascot – Chaos";
      }
      if (wordBackImg) {
        wordBackImg.src = imageBase + "gobbo/gobbo_word_nohood.png";
        wordBackImg.alt = "Goblin mascot – Word";
      }
    }

    // Add flipping class for animation
    chaosCard.classList.add("flipping");
    wordCard.classList.add("flipping");

    // Wait for card to flip halfway (when it's facing away), then update content
    setTimeout(function () {
      const flipType = flipCount % 3; // 0 = regular, 1 = duel, 2 = goblin mode

      if (flipType === 1) {
        // Duel flip
        const duel = getNextDuel();
        const duelTrigger = getNextDuelTrigger();

        chaosCard.classList.add("is-duel");
        chaosCard.classList.remove("is-goblin-mode");

        if (chaosLabel) chaosLabel.textContent = "Duel";
        if (wordLabel) wordLabel.textContent = "Showdown!";

        updateChaosCueChip(null);

        if (chaosTitle) {
          let titleText = duel.title;
          if (titleText.includes(":")) {
            titleText = titleText.replace(":", ":<br>");
            chaosTitle.innerHTML = titleText;
          } else {
            chaosTitle.textContent = titleText;
          }
          chaosTitle.classList.add("duel-title");
          chaosTitle.classList.remove("goblin-title");
        }
        if (chaosDescription) {
          let descriptionWithBreaks = duel.description.replace(/\\n/g, "<br>");
          descriptionWithBreaks = descriptionWithBreaks.replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
          );
          chaosDescription.innerHTML = descriptionWithBreaks;
        }

        if (wordText) {
          wordText.innerHTML =
            duelTrigger +
            '<br><span class="goblin-word-sub">Reveal a Duel Card. If it\'s a 2 Player Duel, choose your opponent.</span>';
        }

      } else if (flipType === 2) {
        // Goblin Mode flip - all-play challenge
        const goblinCard = getNextGoblinMode();

        chaosCard.classList.add("is-goblin-mode");
        chaosCard.classList.remove("is-duel");

        if (chaosLabel) chaosLabel.textContent = "Mass Duel";
        if (wordLabel) wordLabel.textContent = "Mass Duel!";

        updateChaosCueChip(null);

        if (chaosTitle) {
          chaosTitle.textContent = goblinCard.title;
          chaosTitle.classList.add("goblin-title");
          chaosTitle.classList.remove("duel-title");
        }
        if (chaosDescription) {
          let descText = goblinCard.text.replace(/\n/g, "<br>");
          descText = descText.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
          chaosDescription.innerHTML = descText;
        }

        if (wordText) wordText.innerHTML = "Mass Duel!<br><span class=\"goblin-word-sub\">everyone plays</span>";

      } else {
        // Regular flip
        chaosCard.classList.remove("is-duel");
        chaosCard.classList.remove("is-goblin-mode");

        if (chaosLabel) chaosLabel.textContent = "Chaos Prompt";
        if (wordLabel) wordLabel.textContent = "Words";

        const randomChaos = getRandomItem(chaosPrompts);
        const randomWord = getRandomItem(wordList);

        if (chaosTitle) {
          chaosTitle.textContent = randomChaos.title;
          chaosTitle.classList.remove("duel-title");
          chaosTitle.classList.remove("goblin-title");
        }
        if (chaosDescription) {
          chaosDescription.textContent = randomChaos.description;
        }
        updateChaosCueChip(randomChaos);

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

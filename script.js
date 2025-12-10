// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Set current year in footer
    const yearElement = document.getElementById('current-year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }

    // Card Demo Data
    const chaosPrompts = [
        {
            title: "Tongue Out",
            description: "Stick your tongue out and keep it out while giving clues."
        },
        {
            title: "The Worm",
            description: "Give clues while attempting to do the worm."
        },
        {
            title: "Meow After Every Word",
            description: "After every single word, add a 'meow.'"
        },
        {
            title: "Excited Kindergartener",
            description: "Give clues like an overexcited kindergartener telling their parents about this thing."
        },
        {
            title: "Infomercial Host",
            description: "Give clues like a late-night infomercial host who really needs this to sell."
        },
        {
            title: "Pirate Captain",
            description: "Give clues like a pirate captain talking to their crew."
        },
        {
            title: "Villain Monologue",
            description: "Give clues like a villain explaining their plan to the hero."
        },
        {
            title: "Clueless Tour Guide",
            description: "Give clues like you're a tour guide who has never seen this object before, but must pretend you know everything about it."
        },
        {
            title: "Time Traveler from the Past",
            description: "Give clues like you're a time traveler from the past seeing this for the first time."
        },
        {
            title: "Time Traveler from the Future",
            description: "Give clues like you're a time traveler from the future who knows this will destroy everything."
        }
    ];

    // Word list from game data
    const wordList = [
        "Airplane", "Alarm clock", "Alligator", "Ambulance", "Amnesia",
        "Applause", "Apple", "Astronaut", "Baby", "Backpack",
        "Bacteria", "Baker", "Ball", "Bamboo", "Banana", "Banana peel", "Bandage", "Barbeque",
        "Barbie", "Bartender", "Baseball", "Basketball", "Bat", "Bays", "Beach", "Beauty queen",
        "Bed", "Bee", "Belly button", "Bike", "Binder", "Bird", "Birthday cake", "Blanket",
        "Blender", "Board game", "Boat", "Book", "Boomerang", "Boredom", "Bowl", "Bowling",
        "Bridge", "Broom", "Bubble", "Bubblegum", "Bucket", "Bull", "Bureaucracy", "Burp",
        "Butterfly", "CD", "Cake", "Cake/pie", "Calculator", "Calendar",
        "Camera", "Camouflage", "Campfire", "Candle", "Candy", "Candy bar", "Car", "Car mechanic",
        "Cashier", "Cat", "Ceiling fan", "Celery", "Cell Phone", "Chair", "Chairs", "Chandelier",
        "Chicken", "Chicken dance", "Chips and dip", "Chocolate", "Cinderella",
        "Clipboard", "Clock", "Clothes", "Clown car", "Coffee", "Coffee cup", "Computer coder",
        "Confetti", "Constellation", "Cotton Candy", "Cotton candy",
        "Couch potato", "Cow", "Cowboy", "Cream", "Cup", "Cushion", "Desk", "Desk lamp",
        "Detective", "Diaper", "Dinosaur", "Doctor/nurse", "Dog", "Dog leash", "Door",
        "Drawbridge", "Drawing", "Dress", "Drum", "Drums", "Dynamite", "Easel", "Egg", "Einstein",
        "Elephant", "Elmo", "Employee", "Escalator", "Evolution", "Farmer", "Fax machine",
        "Fence", "Ferris wheel", "Fire truck", "Firefighter", "Fish", "Fisherman", "Flame",
        "Flamingo", "Florist", "Flower", "Flute", "Football", "Fox", "French fries", "Frog",
        "Furniture", "Garbage bin", "Gargoyle", "Giraffe", "Glasses", "Glue", "Goldfish bowl",
        "Golf", "Goosebumps", "Gorilla", "Grandma", "Guitar", "Gummy Bears", "Hair Brush",
        "Hair Gel", "Hair stylist", "Hairball", "Haircut", "Hair", "Hamburger", "Hammer",
        "Hammock", "Hand", "Handcuffs", "Harmonica", "Hat", "Home", "Horse", "Hot air balloon",
        "Hot dog", "House", "Hummingbird", "Hypnosis", "Ice", "Ice cream", "Ice cube", "Igloo",
        "Iguana", "Invisibility", "Jacket", "Jackhammer", "Jeans", "Jelly", "Jellyfish", "Judge",
        "Jukebox", "Kaleidoscope", "Kangaroo", "Kayak", "Key", "Keyboard",
        "Kiss", "Kitchen", "Kite", "Laptop", "Laundry", "Lawnmower", "Leaf", "Librarian",
        "Library", "Lifeguard", "Light", "Lighthouse", "Lion", "Llama", "Lollipop", "Lumberjack",
        "Mac-and-cheese", "Magician", "Magnetism", "Mailbox", "Makeup artist", "Mario",
        "Mechanic", "Meditation", "Microscope", "Mirage", "Monday", "Money",
        "Monkey", "Moon", "Moonwalk", "Moose", "Mouse", "Mullet", "Mummy",
        "Newspaper", "Noodle", "Nostalgia", "Notebook", "Notepad", "Octopus", "Orange",
        "Orchestra", "Ostrich", "Owl", "Painting", "Paintings", "Palace", "Pancakes", "Pants",
        "Paper", "Paperclips", "Paperwork", "Parachute", "Parrot", "Pay cheque", "Pen", "Pencil",
        "Pencil Case", "Penguin", "Philosophy", "Phone", "Piano", "Pickle", "Picnic basket",
        "Pie", "Pig", "Pikachu", "Pillow", "Pillow fight", "Pinwheel", "Pirate", "Pizza",
        "Plane", "Plate", "Platypus", "Play-Doh", "Playground", "Polar bear", "Police officer",
        "Popcorn", "President", "Pro wrestler", "Pumpkin", "Quicksand", "Rabbit", "Race",
        "Rainbow", "Rapunzel", "Reflection", "Rickshaw", "Ring", "Robot", "Rocket ship",
        "Roller coaster", "Rolling pin", "Root beer", "Sailboat",
        "Sandcastle", "Sandwich", "Santa Claus", "Sasquatch", "Saxophone", "Scarecrow", "Scarf",
        "Schoolbag", "Scissors", "Scooby Doo", "Scratch", "Seaweed", "Secretary", "Seesaw",
        "Shakespeare", "Sheet", "Shirt", "Shoe", "Shoelace", "Skeleton",
        "Skiing", "Skull", "Sky", "Skyscraper", "Sledding", "Smiley face", "Smoke", "Snake",
        "Sneeze", "Snowboarding", "Snowflake", "Snowman", "Socks", "Socrates", "Sofa",
        "Spaghetti", "Spider", "Spider web",
        "Spiderweb", "Spoon", "Squirrel", "Staircase", "Stand-up bass", "Stapler", "Star",
        "Sticky Notes", "Submarine", "Sun", "Sundae", "Sunglasses", "Surfboard", "Sushi",
        "Symmetry", "T-shirt", "Table", "Taco", "Teacher", "Teddy bear", "Telepathy",
        "Telescope", "Tennis", "Tent", "The Beatles", "Thermos", "Tie", "Tiger", "Tiki bar",
        "Tooth", "Toothbrush", "Toothpaste", "Tornado", "Towel", "Traffic jam", "Train",
        "Trampoline", "Tree", "Trombone", "Trophy", "Trumpet", "Tuba", "Turkey", "Ukelele",
        "Umbrella", "Underpants", "Unicorn", "Unicycle", "Valet Driver", "Vanilla",
        "Veterinarian", "Video camera", "Violin", "Volcano", "WIFI",
        "Waffle", "Waiter/server", "Waldo", "Watch", "Water Bottle", "Waterfall", "Watermelon",
        "Windmill", "Windshield", "Work", "Work computer", "Workload", "Worm",
        "X-ray", "Xylophone", "Yo-yo", "Zebra", "Zipper", "Zombie", "apple pie", "astronaut",
        "badge", "bagel", "ballet", "barcode", "basket", "battery", "beach", "beard", "beaver",
        "bedbug", "beetle", "bikini", "black hole", "blacksmith", "blanket", "blimp", "blood",
        "bluetooth", "bonnet", "bottle", "bounce", "bow tie", "bowtie", "boyfriend", "braces",
        "brainstorm", "break", "brick", "bubble", "bucket", "bunk bed", "burrito", "butter",
        "button", "calendar", "candle", "candy cane", "carrot", "catfish", "cell", "chain",
        "chandelier", "chemistry", "chimney", "circus", "clap", "cloud", "clown", "cobra",
        "cockroach", "constellation", "corndog", "country", "cradle", "cupcake", "curtains",
        "cymbal", "dance", "deer", "dimple", "disk", "doctor", "door knob", "dot", "download",
        "dragonfly", "drain", "dress", "e-mail", "eel", "elbow", "electricity", "eyebrow",
        "eyelash", "family", "faucet", "fence", "finger", "fire hydrant", "fireworks", "fishing",
        "fishing pole", "flagpole", "flute", "fork", "frame", "full moon", "funnel", "garage",
        "garden", "gate", "girlfriend", "glove", "glue", "goal", "goldfish", "green", "halo",
        "handle", "harp", "headband", "highchair", "hockey", "honey", "honk", "hose", "houseboat",
        "hug", "ice", "ice fishing", "idea", "igloo", "internet", "ironing board", "junk mail",
        "knife", "lady bug", "lake", "laser", "leaf", "leprechaun", "letter opener", "lettuce",
        "light bulb", "light switch", "lighthouse", "lobster", "location", "lock", "lollipop",
        "luggage", "lunchbox", "macaroni", "magnet", "mail", "mailbox", "makeup", "map",
        "marriage", "mask", "math", "maze", "milk", "mime", "mine cart", "moat", "motorcycle",
        "movie", "music", "night", "north pole", "ocean", "onion", "pacifier", "pancakes",
        "paper", "paper clip", "password", "peanut", "pear", "pearl necklace", "pencil",
        "people", "photograph", "photographer", "pine tree", "pineapple", "plate", "poodle",
        "popcorn", "popsicle", "porcupine", "positive", "pregnant", "president", "pretzel",
        "printer", "pumpkin", "purse", "pushup", "puzzle", "quicksand", "railroad", "raven",
        "ring", "river", "rollerblade", "rollercoaster", "rug", "sailboat", "sand", "sand castle",
        "saw", "scarf", "seahorse", "seat belt", "sheep", "shoelaces", "shoulder", "sidewalk",
        "sit-up", "skunk", "smoke", "snowflake", "sock", "sofa", "solar eclipse", "solar system",
        "soul", "space", "spin", "stairs", "stamp", "stapler", "stethoscope", "stingray",
        "stomach", "stoplight", "stork", "storm", "strawberry", "strong", "suitcase", "sun",
        "sunflower", "sunglasses", "sunshine", "surfboard", "sword", "tall", "taxi", "teepee",
        "teleport", "text", "time machine", "tire", "tissue", "toast", "toes", "tongue", "towel",
        "trampoline", "trash can", "treasure", "tree branch", "tree stump", "turkey", "umbrella",
        "usb", "vase", "vest", "video", "wallet", "watch", "waterfall", "wax",
        "webcam", "wedding cake", "wheelbarrow", "wind", "wing", "wood", "worm", "wreath",
        "writing", "zipper"
    ];

    // Card Demo Functionality
    const chaosCard = document.getElementById('chaos-card');
    const wordCard = document.getElementById('word-card');
    const chaosTitle = document.getElementById('chaos-title');
    const chaosDescription = document.getElementById('chaos-description');
    const wordText = document.getElementById('word-text');

    function getRandomItem(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    // Circular progress indicator for flip timer
    const flipTimer = document.getElementById('flip-timer');
    const timerCircle = flipTimer ? flipTimer.querySelector('.timer-circle') : null;
    const timerCountdown = document.getElementById('timer-countdown');

    function updateProgress(progress) {
        if (timerCircle) {
            // stroke-dashoffset goes from 100 (empty) to 0 (full)
            const offset = 100 - progress;
            timerCircle.style.strokeDashoffset = offset;
        }
        // Update countdown (10 seconds total)
        if (timerCountdown) {
            const secondsRemaining = Math.ceil((100 - progress) / (100 / 10));
            timerCountdown.textContent = secondsRemaining > 0 ? secondsRemaining : 10;
        }
    }

    function resetProgress() {
        if (timerCircle) {
            timerCircle.style.strokeDashoffset = 100;
        }
        if (timerCountdown) {
            timerCountdown.textContent = '10';
        }
    }

    function flipCards() {
        // Only flip if cards exist (they're in the hero section)
        if (!chaosCard || !wordCard) return;

        // Reset progress indicator
        resetProgress();

        // Add flipping class for animation
        chaosCard.classList.add('flipping');
        wordCard.classList.add('flipping');

        // Wait for card to flip halfway (when it's facing away), then update content
        setTimeout(function() {
            // Get random chaos prompt and word
            const randomChaos = getRandomItem(chaosPrompts);
            const randomWord = getRandomItem(wordList);

            // Update chaos card
            if (chaosTitle) chaosTitle.textContent = randomChaos.title;
            if (chaosDescription) chaosDescription.textContent = randomChaos.description;

            // Update word card
            if (wordText) wordText.textContent = randomWord;
        }, 600); // Half of the 1200ms transition duration

        // Remove flipping class after animation completes to reset for next flip
        setTimeout(function() {
            chaosCard.classList.remove('flipping');
            wordCard.classList.remove('flipping');
        }, 1200); // Full transition duration
    }

    // Auto-flip cards every 10 seconds with progress indicator
    if (chaosCard && wordCard) {
        let progress = 0;
        let progressInterval = null;
        
        function startProgressTimer() {
            // Clear any existing interval
            if (progressInterval) {
                clearInterval(progressInterval);
            }
            
            // Reset progress
            progress = 0;
            updateProgress(0);
            
            // Start new interval
            progressInterval = setInterval(function() {
                progress += (100 / 100); // 100% in 10 seconds (100 * 100ms)
                updateProgress(progress);
                
                if (progress >= 100) {
                    clearInterval(progressInterval);
                    progressInterval = null;
                }
            }, 100); // Update every 100ms
        }
        
        // Override resetProgress to restart timer
        const originalResetProgress = resetProgress;
        resetProgress = function() {
            originalResetProgress();
            startProgressTimer();
        };
        
        // Start the timer
        startProgressTimer();
        
        // Flip immediately on load
        flipCards();
        
        // Flip every 10 seconds
        setInterval(function() {
            flipCards();
        }, 10000);
    }

    // Hamburger menu toggle
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks = document.getElementById('nav-links');
    
    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', function() {
            menuToggle.classList.toggle('active');
            navLinks.classList.toggle('active');
        });
        
        // Close menu when clicking on a link
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', function() {
                menuToggle.classList.remove('active');
                navLinks.classList.remove('active');
            });
        });
    }

    // Smooth scroll for anchor links (fallback if CSS doesn't work)
    // Note: Modern browsers support CSS scroll-behavior: smooth, but this is a fallback
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            // Skip if it's just "#" or empty
            if (href === '#' || href === '#top') {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
            
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
});


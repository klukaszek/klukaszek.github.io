// script.js

var lastCommand = '';
var currentCommand = '';

// Dictionary of valid input commands and their corresponding output commands
const commands = {
    // Main commands
    'home': 'home',
    'about': 'about',
    'projects': 'projects',
    'contact': 'contact',
    // 'blog': 'blog',
    'resume': 'resume',
    'github': 'github',
    'twitter': 'twitter',

    // Alias commands
    'h': 'home',
    'a': 'about',
    'p': 'projects',
    'c': 'contact',
    // 'b': 'blog',
    'r': 'resume',
    'q': 'return',
    'gh': 'github',
    'tw': 'twitter',
    'x': 'twitter',
}

// Initialize with home content
loadContent('home');

// Load content from the corresponding HTML file and update the status bar
function loadContent(page) {
    const mainContent = document.getElementById('main-content');
    const statusBar = document.getElementById('status-bar');

    let x = `${page}`.toLowerCase();

    // Handle a few special cases first
    if (x === 'resume') {
        window.open('./resume.pdf', '_blank');
        return;
    } else if (x === 'github') {
        window.open('https://github.com/klukaszek/', '_blank');
        return;
    } else if (x === 'twitter') {
        window.open('https://twitter.com/kylelukaszek', '_blank');
        return;
    } else if (x === 'return') {
        if (lastCommand === '') lastCommand = 'home';
        loadContent(lastCommand);
        return;
    }

    // Update status bar
    const mode = x.toUpperCase();
    document.getElementById('mode').textContent = `${mode}`;
    document.getElementById('file-info').textContent = `${page}.html`;

    // Fetch content from the corresponding HTML file
    fetch(`pages/${page}.html`)
        .then(response => response.text())
        .then(html => {
            mainContent.innerHTML = html;
            addEventListenersToCommands();
            lastCommand = currentCommand;
            currentCommand = `${page}`;
            updateScrollPercentage();
        })
        .catch(error => {
            mainContent.innerHTML = `<h2>Error loading ${page}</h2><p>${error}</p>`;
            updateScrollPercentage();
        });
}

// Command Input Methods
// -------------------------------------------------

// Add click and key event listeners to the command elements
// so that we can navigate to the corresponding pages
function addEventListenersToCommands() {
    document.querySelectorAll('.command').forEach(item => {
        // Add click event listener for the command
        item.addEventListener('click', function() {
            const page = this.textContent.slice(1); // Remove the colon
            loadContent(page);
        });

        // Add key event listener for the enter key
        item.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                const page = this.textContent.slice(1); // Remove the colon
                loadContent(page);
            }
        });
    });
}

// Toggle the command input when the colon is clicked
function showCommandInput() {
    const commandInput = document.getElementById('command-input');
    const commandText = document.getElementById('command-text');
    commandInput.style.display = 'flex';
    commandText.value = ''; // Clear any previous input
    commandText.focus();
}

// Hide the command input when the escape key is pressed
function hideCommandInput() {
    const commandInput = document.getElementById('command-input');
    const commandText = document.getElementById('command-text');
    commandInput.style.display = 'none';
    commandText.value = ''; // Clear the input when hiding
}

// Handle the command input when the enter key is pressed
function handleCommand(command) {
    if (currentCommand === commands[command]) {
        // Do nothing if the command is the same as the current page
    } else if (commands[command]) {
        loadContent(commands[command]);
    } else {
        console.warn(`Command not found: ${command}`);
    }
    hideCommandInput();
}

// Add event listener for the ':' key
document.addEventListener('keydown', function(event) {
    if (event.key === ':') {
        event.preventDefault(); // Prevent the ':' from being typed
        showCommandInput();
    } else if (event.key === 'Escape') {
        if (document.activeElement === document.getElementById('command-text')) {
            hideCommandInput();
        } else {
            loadContent("home");
        }
    }
});

// Add event listener for command input
document.getElementById('command-text').addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        const command = this.value.toLowerCase();
        handleCommand(command);
    } else if (event.key === 'Escape') {
        hideCommandInput();
    }
});

// Status Bar Methods
// -------------------------------------------------

function updateScrollPercentage() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollBottom = window.innerHeight + scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrollPercentage = Math.round((scrollTop / scrollHeight) * 100);

    // Ensure the percentage is between 0 and 100
    var percentage = Math.min(100, Math.max(0, scrollPercentage));
    if (isNaN(percentage)) percentage = 100;

    // Calculate the current line (assuming an average line height of 20px)
    const lineHeight = 30;
    const currentLine = Math.floor(scrollBottom / lineHeight);

    // Calculate the total number of lines
    const totalLines = Math.floor(document.documentElement.scrollHeight / lineHeight);

    // Update the status bar
    document.getElementById('percentage').textContent = `${percentage}%`;
    document.getElementById('line-col').textContent = `${currentLine}:0`;

    // Update file info to show current line / total lines
    document.getElementById('file-info').textContent = `${currentCommand}.html [${currentLine}/${totalLines}]`;
}

// Add event listener for scroll events
window.addEventListener('scroll', updateScrollPercentage);

// Add event listener for resize events
window.addEventListener('resize', updateScrollPercentage);

// Initialize the scroll percentage
updateScrollPercentage();

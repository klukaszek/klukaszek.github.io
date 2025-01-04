// script.js

// We imported the marked script in our index file, so we have to import it here in order to use it

var lastCommand = '';
var currentCommand = '';

// Create a stack to store the history of commands
var pageHistory = [];
var pageIndex = -1;

// Dictionary of valid input commands and their corresponding output commands
const commands = {
    // Main commands
    'home': 'home',
    'about': 'about',
    'projects': 'projects',
    'contact': 'contact',
    'blog': 'blog',
    'work': 'jobs',
    'jobs': 'jobs',
    'resume': 'resume',
    'github': 'github',
    'twitter': 'twitter',

    // Alias commands
    'h': 'home',
    'a': 'about',
    'p': 'projects',
    'c': 'contact',
    'b': 'blog',
    'w': 'jobs',
    'j': 'jobs',
    'r': 'resume',
    'q': 'return',
    'gh': 'github',
    'tw': 'twitter',
    'x': 'twitter',
}

function addEventListenersToBlog() {
    const modal = document.getElementById('markdown-modal');
    const modalContent = document.getElementById('markdown-content');
    const spinner = document.getElementById('loading-spinner');
    const closeButton = document.querySelector('.close-button');

    // Close modal when clicking the close button
    closeButton.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // Close modal when clicking outside the content
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Close modal when pressing Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'block') {
            modal.style.display = 'none';
        }
    });

    // Handle "Read more" clicks
    document.querySelectorAll('.read-more').forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const path = e.target.getAttribute('href');

            // Show modal and loading spinner
            modal.style.display = 'block';
            modalContent.style.display = 'none';
            spinner.style.display = 'block';

            try {
                // Load and parse markdown
                const response = await window.fetch(path).then(res => res.text());
                const htmlContent = marked.parse(response);
                modalContent.innerHTML = htmlContent;
            } catch (error) {
                console.error('Error loading markdown:', error);
                modalContent.innerHTML = '<p style="color: #ff0000;">Error loading content</p>';
            } finally {
                // Hide spinner and show content
                spinner.style.display = 'none';
                modalContent.style.display = 'block';
            }
        });
    });
}

// Load content from the corresponding HTML file and update the status bar
function loadContent(page) {
    const mainContent = document.getElementById('main-content');

    let x = `${page}`.toLowerCase();

    // Handle a few special cases first
    if (x === 'resume') {
        window.open('./static/pdfs/resume.pdf', '_blank');
        return;
    } else if (x === 'github') {
        window.open('https://github.com/klukaszek/', '_blank');
        return;
    } else if (x === 'twitter') {
        window.open('https://twitter.com/kylelukaszek', '_blank');
        return;
    } else if (x === 'return') {
        // Handle the page history and return arrow for mobile, etc.
        if (pageIndex > 0) {
            const previousCommand = pageHistory[pageIndex - 1];
            pageHistory.pop();
            pageIndex = pageHistory.length - 1;
            //console.log(pageHistory);
            loadContent(previousCommand);
        }
        return;
    }

    // Handle the page history and return arrow for mobile, etc.
    if (x === 'home') {
        // Remove return arrow from home page
        const returnArrow = document.getElementById('mobile-return');
        if (returnArrow) {
            returnArrow.style.display = 'none';
        }
        // clear the page history
        pageHistory = [];
        pageIndex = -1;
    } else {
        // Add return arrow to all other pages
        const returnArrow = document.getElementById('mobile-return');
        if (returnArrow) {
            returnArrow.style.display = 'block';
        }
    }

    // Check if the current page is the last page in the history stack
    if (pageHistory[pageIndex] !== page) {
        // Add the command to the history stack
        pageHistory.push(page);
        pageIndex = pageHistory.length - 1;
        //console.log(pageHistory);
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
            if (x === 'blog') addEventListenersToBlog();
            lastCommand = currentCommand;
            currentCommand = `${page}`;
            updateScrollPercentage();
        })
        .catch(error => {
            mainContent.innerHTML = `<h2>Error loading ${page}</h2><p>${error}</p>`;
            updateScrollPercentage();
        });
}

// Return arrow for mobile or people who don't know how to use the commands
// -------------------------------------------------
document.getElementById('mobile-return').addEventListener('click', function() {
    loadContent('return');
});

document.getElementById('mobile-return').addEventListener('keydown', function(event) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        loadContent('return');
    }
});

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

// Initialize with home content
loadContent('home');

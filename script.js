// script.js

var lastCommand = '';
var currentCommand = '';
var pageHistory = [];
var pageIndex = -1;

const commands = {
    'home': 'home', 'about': 'about', 'projects': 'projects', 'contact': 'contact',
    'blog': 'blog', 'work': 'jobs', 'jobs': 'jobs', 'resume': 'resume',
    'github': 'github', 'twitter': 'twitter', 'h': 'home', 'a': 'about',
    'p': 'projects', 'c': 'contact', 'b': 'blog', 'w': 'jobs', 'j': 'jobs',
    'r': 'resume', 'q': 'return', 'gh': 'github', 'tw': 'twitter', 'x': 'twitter',
};

function addEventListenersToBlog() {
    // ... (your existing function)
    const modal = document.getElementById('markdown-modal');
    const modalContent = document.getElementById('markdown-content');
    const spinner = document.getElementById('loading-spinner');
    const closeButton = document.querySelector('.close-button');

    if (!modal || !modalContent || !spinner || !closeButton) {
        console.warn("Blog modal elements not found. Skipping blog event listener setup.");
        return;
    }
    
    closeButton.addEventListener('click', () => modal.style.display = 'none');
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'block') modal.style.display = 'none';
    });

    document.querySelectorAll('.read-more').forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const path = e.target.getAttribute('href');
            modal.style.display = 'block';
            modalContent.style.display = 'none'; // Hide content while loading
            spinner.style.display = 'block';
            try {
                const response = await window.fetch(path).then(res => res.text());
                const htmlContent = marked.parse(response);
                modalContent.innerHTML = htmlContent;
            } catch (error) {
                console.error('Error loading markdown:', error);
                modalContent.innerHTML = '<p style="color: #ff0000;">Error loading content</p>';
            } finally {
                spinner.style.display = 'none';
                modalContent.style.display = 'block'; // Show content after loading
            }
        });
    });
}

function loadContent(page) {
    const mainContent = document.getElementById('main-content');
    let x = `${page}`.toLowerCase();

    // Fade out current content before loading new, unless it's the very first load
    if (mainContent.classList.contains('loaded')) {
        mainContent.classList.remove('loaded'); // Start fade-out
    }

    const handleExternalLink = () => {
        // If content was fading out, make it reappear if there's history,
        // or load home if it was the very first action.
        if (!mainContent.classList.contains('loaded')) {
            if (pageHistory.length > 0 || currentCommand) { // Check if there was a page before
                 // Re-trigger load of current command to make it visible
                 // This avoids complex state, just reload the last known good page
                if(currentCommand && commands[currentCommand]){
                    loadContent(commands[currentCommand]); // Reload the page that was visible
                } else {
                     loadContent('home'); // Fallback to home
                }
            } else {
                // First action was an external link, load home so page isn't blank
                loadContent('home');
            }
        }
    };
    
    if (x === 'resume') {
        window.open('./static/pdfs/resume.pdf', '_blank');
        handleExternalLink();
        return;
    } else if (x === 'github') {
        window.open('https://github.com/klukaszek/', '_blank');
        handleExternalLink();
        return;
    } else if (x === 'twitter') {
        window.open('https://twitter.com/kylelukaszek', '_blank');
        handleExternalLink();
        return;
    } else if (x === 'return') {
        if (pageIndex > 0) {
            // Do not pop here, let the recursive loadContent handle history for the target page
            pageIndex--; // Go back in history index
            const previousCommand = pageHistory[pageIndex]; 
            pageHistory.splice(pageIndex + 1); // Clear "forward" history
            loadContent(previousCommand);
        } else {
             // If at the beginning of history or no history, ensure home is loaded and visible
            loadContent('home');
        }
        return;
    }

    if (x === 'home') {
        const returnArrow = document.getElementById('mobile-return');
        if (returnArrow) returnArrow.style.display = 'none';
        pageHistory = [page]; // Start history with home
        pageIndex = 0;
    } else {
        const returnArrow = document.getElementById('mobile-return');
        if (returnArrow) returnArrow.style.display = 'block';
        // Add to history if not already the current page due to back/forward
        if (pageHistory[pageIndex] !== page) {
            pageHistory.splice(pageIndex + 1); // Clear any "forward" history
            pageHistory.push(page);
            pageIndex = pageHistory.length - 1;
        }
    }
    
    document.getElementById('mode').textContent = `${x.toUpperCase()}`;

    const fetchContent = () => {
        fetch(`pages/${page}.html`)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status} for ${page}.html`);
                return response.text();
            })
            .then(html => {
                mainContent.innerHTML = html;
                addEventListenersToCommands();
                if (x === 'blog') addEventListenersToBlog();
                lastCommand = currentCommand; // Keep track of the command that successfully loaded
                currentCommand = `${page}`;
                
                mainContent.classList.add('loaded'); // Fade in new content
            })
            .catch(error => {
                mainContent.innerHTML = `<h2>Error loading ${page}</h2><p>${error}</p>`;
                mainContent.classList.add('loaded'); // Still show the error message
                // Potentially revert currentCommand if load failed, or show error state in status bar
                // currentCommand = lastCommand; // Revert to last known good command
            });
    };

    // If content was fading out, wait for transition before fetching new content
    // Otherwise (initial load), fetch immediately.
    if (mainContent.classList.contains('loaded') === false && currentCommand !== '') { // Check if it was previously loaded
        setTimeout(fetchContent, 300); // Corresponds to CSS transition duration
    } else {
        fetchContent(); // Initial load or no fade-out was triggered
    }
}

document.getElementById('mobile-return').addEventListener('click', function() {
    loadContent('return');
});
document.getElementById('mobile-return').addEventListener('keydown', function(event) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        loadContent('return');
    }
});

function addEventListenersToCommands() {
    document.querySelectorAll('.command').forEach(item => {
        item.addEventListener('click', function() {
            const page = this.textContent.slice(1);
            if (commands[page]) loadContent(commands[page]);
            else if (commands[page.toLowerCase()]) loadContent(commands[page.toLowerCase()]);
            else loadContent(page); // Fallback if not in commands (e.g. from HTML directly)
        });
        item.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                const page = this.textContent.slice(1);
                if (commands[page]) loadContent(commands[page]);
                else if (commands[page.toLowerCase()]) loadContent(commands[page.toLowerCase()]);
                else loadContent(page);
            }
        });
    });
}

function showCommandInput() {
    const commandInput = document.getElementById('command-input');
    const commandText = document.getElementById('command-text');
    commandInput.style.display = 'flex';
    commandText.value = '';
    commandText.focus();
}

function hideCommandInput() {
    document.getElementById('command-input').style.display = 'none';
    document.getElementById('command-text').value = '';
}

function handleCommand(command) {
    const lowerCommand = command.toLowerCase();
    if (commands[lowerCommand] && currentCommand === commands[lowerCommand]) {
        // Do nothing if already on that page
    } else if (commands[lowerCommand]) {
        loadContent(commands[lowerCommand]);
    } else {
        console.warn(`Command not found: ${command}`);
        // Optionally display "command not found" in the UI briefly
    }
    hideCommandInput();
}

document.addEventListener('keydown', function(event) {
    if (event.key === ':' && document.activeElement !== document.getElementById('command-text')) {
        event.preventDefault();
        showCommandInput();
    } else if (event.key === 'Escape') {
        if (document.activeElement === document.getElementById('command-text')) {
            hideCommandInput();
        } else if (document.getElementById('markdown-modal') && document.getElementById('markdown-modal').style.display === 'block') {
            // Handled by blog event listener
        } else {
            loadContent("home");
        }
    }
});

document.getElementById('command-text').addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        handleCommand(this.value);
    } else if (event.key === 'Escape') {
        hideCommandInput();
    }
});

function updateScrollPercentage() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent.classList.contains('loaded') && mainContent.innerHTML.trim() === '') {
        // Don't calculate if content isn't loaded or is empty, to prevent NaN
        document.getElementById('percentage').textContent = `100%`;
        document.getElementById('line-col').textContent = `0:0`;
        document.getElementById('file-info').textContent = `${currentCommand || 'home'}.html [0/0]`;
        return;
    }

    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const contentHeight = mainContent.scrollHeight; // Use mainContent's scrollHeight
    const viewportHeight = window.innerHeight;
    
    let percentage;
    if (contentHeight <= viewportHeight - document.getElementById('status-bar').offsetHeight - 20 /* approx #content padding */ ) {
        percentage = 100; // Content fits entirely, show 100%
    } else {
        const scrollableHeight = contentHeight - (viewportHeight - document.getElementById('status-bar').offsetHeight - 20);
        percentage = Math.min(100, Math.max(0, Math.round((scrollTop / scrollableHeight) * 100)));
    }
    if (isNaN(percentage)) percentage = 100;


    const lineHeight = 20; // Approximate line height, adjust as needed
    const currentLine = Math.max(1, Math.floor((scrollTop + viewportHeight - document.getElementById('status-bar').offsetHeight - 20) / lineHeight));
    const totalLines = Math.max(1, Math.floor(contentHeight / lineHeight));
    
    document.getElementById('percentage').textContent = `${percentage}%`;
    document.getElementById('line-col').textContent = `${currentLine}:${totalLines}`; // Show current:total
    document.getElementById('file-info').textContent = `${currentCommand || 'home'}.html [${currentLine}/${totalLines}]`;
}

window.addEventListener('scroll', updateScrollPercentage);
window.addEventListener('resize', updateScrollPercentage);

updateScrollPercentage();

// Initialize
loadContent('home');

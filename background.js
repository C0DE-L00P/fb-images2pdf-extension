// Keep track of downloaded files
let downloadedFiles = new Map();

// Establish connection when content script connects
chrome.runtime.onConnect.addListener(function(port) {
    console.log("Connected to content script");
});

// Handle extension button clicks
chrome.action.onClicked.addListener(async (tab) => {
    if (!tab.url.includes('facebook.com')) {
        console.error('This extension only works on Facebook');
        return;
    }
    
    try {
        // Inject jsPDF library first
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['jspdf.umd.min.js']
        });

        // Then inject our content script
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
        });

        // Finally send the start message
        await chrome.tabs.sendMessage(tab.id, { action: 'start' });
    } catch (error) {
        console.error('Error injecting scripts:', error);
    }
});
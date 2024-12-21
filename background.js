// Listen for connections from content scripts
chrome.runtime.onConnect.addListener(function(port) {
    console.log("Connected to content script");
});

// Handle button clicks
chrome.action.onClicked.addListener(async (tab) => {
    try {
        // Check if we're on Facebook
        if (!tab.url.includes('facebook.com')) {
            console.error('This extension only works on Facebook');
            return;
        }

        // Send message to content script
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'start' })
            .catch(error => {
                console.log('Error sending message:', error);
                // If content script isn't ready, reload the tab and try again
                chrome.tabs.reload(tab.id);
            });
            
    } catch (error) {
        console.error('Error:', error);
    }
}); 
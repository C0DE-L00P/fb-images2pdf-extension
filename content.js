// Only initialize if we haven't already
if (typeof window.fbImageToPdfInitialized === 'undefined') {
    window.fbImageToPdfInitialized = true;
    console.log('Content script loaded');

    // Establish connection with background script
    const port = chrome.runtime.connect();

    let collectedImages = new Set();
    let imageDataUrls = [];

    function removeOverlay() {
        const overlay = document.querySelector('body > div.__fb-light-mode.x1n2onr6.xzkaem6 > div.x9f619.x1n2onr6.x1ja2u2z > div');
        if (overlay) {
            overlay.remove();
        }
    }

    async function getCurrentImage() {
        const img = document.querySelector('[data-visualcompletion="media-vc-image"]');
        if (!img) return null;
        
        try {
            // Fetch the image as blob
            const response = await fetch(img.src);
            const blob = await response.blob();
            
            // Convert blob to data URL
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('Error getting image:', error);
            return null;
        }
    }

    function clickNextButton() {
        const nextButton = document.querySelector('[style*="background-position: 0px -25px; background-size: auto; width: 24px; height: 24px; background-repeat: no-repeat; display: inline-block;"]');
        if (nextButton) {
            nextButton.click();
            return true;
        }
        return false;
    }

    async function collectImage(imageDataUrl) {
        if (collectedImages.has(imageDataUrl)) {
            console.log('Reached first collected image. Creating PDF...');
            await createPDF();
            return false;
        }
        
        collectedImages.add(imageDataUrl);
        imageDataUrls.push(imageDataUrl);
        console.log(`Collected image ${imageDataUrls.length}`);
        return true;
    }

    async function createPDF() {
        if (typeof html2pdf === 'undefined') {
            console.error('html2pdf library not loaded');
            return;
        }

        // Create a container for images
        const container = document.createElement('div');
        container.style.display = 'none';
        document.body.appendChild(container);

        // Create and append all image elements
        const imagePromises = imageDataUrls.map(dataUrl => {
            return new Promise((resolve, reject) => {
                const img = document.createElement('img');
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = dataUrl;
                img.style.width = '100%';
                img.style.marginBottom = '20px';
                container.appendChild(img);
            });
        });

        try {
            // Wait for all images to load
            await Promise.all(imagePromises);

            // Generate PDF
            const opt = {
                margin: 10,
                filename: 'facebook_images.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            await html2pdf().set(opt).from(container).save();
            console.log('PDF created successfully');
        } catch (error) {
            console.error('Error creating PDF:', error);
        } finally {
            // Clean up
            document.body.removeChild(container);
            imageDataUrls = [];
            collectedImages.clear();
        }
    }

    async function processCurrentImage() {
        removeOverlay();
        
        // Wait for the image to load
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Add await here since getCurrentImage is now async
        const imageDataUrl = await getCurrentImage();
        if (!imageDataUrl) {
            console.log('No image found');
            return false;
        }
        
        const shouldContinue = await collectImage(imageDataUrl);
        if (!shouldContinue) {
            return false;
        }
        
        // Wait before clicking next
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return clickNextButton();
    }

    // Start the process when extension button is clicked
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'start') {
            (async function loop() {
                const shouldContinue = await processCurrentImage();
                if (shouldContinue) {
                    setTimeout(loop, 2000);
                }
            })();
            // Send response to acknowledge receipt
            sendResponse({ status: 'started' });
        }
        // Return true to indicate we'll send a response asynchronously
        return true;
    });
} 
let collectedImages = new Set();
let imageUrls = [];

function removeOverlay() {
    const overlay = document.querySelector('body > div.__fb-light-mode.x1n2onr6.xzkaem6 > div.x9f619.x1n2onr6.x1ja2u2z > div');
    if (overlay) {
        overlay.remove();
    }
}

function getCurrentImage() {
    const img = document.querySelector('[data-visualcompletion="media-vc-image"]');
    return img ? img.src : null;
}

function clickNextButton() {
    const nextButton = document.querySelector('[style*="background-position: 0px -25px; background-size: auto; width: 24px; height: 24px; background-repeat: no-repeat; display: inline-block;"]');
    if (nextButton) {
        nextButton.click();
        return true;
    }
    return false;
}

async function collectImage(imageUrl) {
    if (collectedImages.has(imageUrl)) {
        console.log('Reached first collected image. Creating PDF...');
        await createPDF();
        return false;
    }
    
    collectedImages.add(imageUrl);
    imageUrls.push(imageUrl);
    console.log(`Collected image ${imageUrls.length}`);
    return true;
}

async function createPDF() {
    // Create a container for images
    const container = document.createElement('div');
    container.style.display = 'none';
    document.body.appendChild(container);

    // Add all images to the container
    for (const url of imageUrls) {
        const img = document.createElement('img');
        img.src = url;
        img.style.width = '100%';
        img.style.marginBottom = '20px';
        container.appendChild(img);
    }

    // Wait for images to load
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generate PDF
    const opt = {
        margin: 10,
        filename: 'facebook_images.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
        await html2pdf().set(opt).from(container).save();
        console.log('PDF created successfully');
    } catch (error) {
        console.error('Error creating PDF:', error);
    }

    // Clean up
    document.body.removeChild(container);
    imageUrls = [];
    collectedImages.clear();
}

async function processCurrentImage() {
    removeOverlay();
    
    // Wait for the image to load
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const imageUrl = getCurrentImage();
    if (!imageUrl) {
        console.log('No image found');
        return false;
    }
    
    const shouldContinue = await collectImage(imageUrl);
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
    }
}); 
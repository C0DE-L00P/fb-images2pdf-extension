// Only initialize if we haven't already
if (typeof window.fbImageToPdfInitialized === 'undefined') {
    window.fbImageToPdfInitialized = true;
    console.log('Content script loaded');

    let collectedImages = new Set();
    let downloadedImages = [];
    let pdfFileName = 'facebook_images';

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

    async function downloadImage(imageUrl, index) {
        try {
            // Send message to background script to download the image
            return new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    action: 'downloadImage',
                    imageUrl: imageUrl,
                    filename: `temp_image_${index}.jpg`
                }, (response) => {
                    if (response && response.success) {
                        resolve(response.filename);
                    } else {
                        resolve(null);
                    }
                });
            });
        } catch (error) {
            console.error('Error downloading image:', error);
            return null;
        }
    }

    async function collectImage(imageUrl) {
        if (collectedImages.has(imageUrl)) {
            console.log('Reached first collected image. Creating PDF...');
            await createPDF(downloadedImages, pdfFileName);
            return false;
        }
        
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const dataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
            
            if (dataUrl) {
                collectedImages.add(imageUrl);
                downloadedImages.push(dataUrl);
                console.log(`Collected image ${downloadedImages.length}`);
            }
        } catch (error) {
            console.error('Error downloading image:', error);
        }
        return true;
    }

    async function createPDF(imageDataUrls, filename) {
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const maxWidth = pageWidth - (2 * margin);
        const maxHeight = pageHeight - (2 * margin);

        for (let i = 0; i < imageDataUrls.length; i++) {
            const img = new Image();
            await new Promise((resolve) => {
                img.onload = resolve;
                img.src = imageDataUrls[i];
            });
            
            // Calculate scaling to fit page while maintaining aspect ratio
            let scale = Math.min(
                maxWidth / img.width,
                maxHeight / img.height
            );

            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;

            // Center image on page
            const x = margin + (maxWidth - scaledWidth) / 2;
            const y = margin + (maxHeight - scaledHeight) / 2;

            if (i > 0) {
                pdf.addPage();
            }

            pdf.addImage(
                imageDataUrls[i],
                'JPEG',
                x,
                y,
                scaledWidth,
                scaledHeight
            );
        }

        // Save the PDF
        pdf.save(filename + '.pdf');
    }

    async function processCurrentImage() {
        removeOverlay();
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
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        return clickNextButton();
    }

    async function promptFileName() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                z-index: 10000;
            `;
            
            modal.innerHTML = `
                <h3 style="margin-top: 0;">Enter PDF filename</h3>
                <input type="text" id="pdfFileNameInput" value="facebook_images" style="margin: 10px 0; padding: 5px;">
                <div style="text-align: right; margin-top: 15px;">
                    <button id="cancelBtn" style="margin-right: 10px; padding: 5px 10px;">Cancel</button>
                    <button id="startBtn" style="padding: 5px 10px; background: #1877f2; color: white; border: none; border-radius: 4px;">Start</button>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            const input = modal.querySelector('#pdfFileNameInput');
            const startBtn = modal.querySelector('#startBtn');
            const cancelBtn = modal.querySelector('#cancelBtn');
            
            startBtn.onclick = () => {
                const fileName = input.value.trim() || 'facebook_images';
                document.body.removeChild(modal);
                resolve(fileName);
            };
            
            cancelBtn.onclick = () => {
                document.body.removeChild(modal);
                resolve(null);
            };
            
            input.focus();
        });
    }

    // Start the process when extension button is clicked
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'start') {
            (async function() {
                const fileName = await promptFileName();
                if (fileName) {
                    pdfFileName = fileName;
                    const loop = async () => {
                        const shouldContinue = await processCurrentImage();
                        if (shouldContinue) {
                            setTimeout(loop, 2000);
                        }
                    };
                    loop();
                }
            })();
            sendResponse({ status: 'started' });
        }
        return true;
    });
} 
document.addEventListener('DOMContentLoaded', () => {
    loadGallery();
});

async function loadGallery() {
    const gallery = document.getElementById('gallery');
    
    try {
        const images = await fetchImages();
        gallery.innerHTML = ''; // Clear loading message
        
        images.forEach(imagePath => {
            const item = createGalleryItem(imagePath);
            gallery.appendChild(item);
        });

        // If no images found
        if (images.length === 0) {
            gallery.innerHTML = '<div class="loading">No images found</div>';
        }
    } catch (error) {
        console.error('Error loading gallery:', error);
        gallery.innerHTML = '<div class="loading">Error loading gallery</div>';
    }
}

function createGalleryItem(imagePath) {
    const div = document.createElement('div');
    div.className = 'gallery-item';
    
    const img = document.createElement('img');
    img.src = imagePath;
    img.alt = imagePath.split('/').pop().split('.')[0].replace(/-/g, ' '); // Use filename as alt text
    img.loading = 'lazy';
    
    // Add error handling for images
    img.onerror = () => {
        img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
        img.alt = 'Failed to load image';
    };
    
    div.appendChild(img);
    return div;
}

async function fetchImages() {
    // This will be populated with actual image paths from your repo
    // For now, return an empty array
    return [];
}

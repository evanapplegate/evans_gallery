document.addEventListener('DOMContentLoaded', () => {
    // Fix for iOS Safari touch events
    document.addEventListener('touchstart', function(){}, {passive: true});
    
    // Remove problematic touchmove handler that might cause iOS warnings
    /*
    document.body.addEventListener('touchmove', function(e) {
        if (e.target.tagName !== 'VIDEO') {
            e.preventDefault();
        }
    }, { passive: false });
    */
    
    // Fix for iOS Safari scrolling issues
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        document.documentElement.style.height = '100%';
        document.body.style.height = '100%';
        document.body.style.webkitOverflowScrolling = 'touch';
    }
    
    loadGallery();
});

let currentPage = 1;
const itemsPerPage = 50;
let allFiles = [];

function createGalleryItem(path) {
    const div = document.createElement('div');
    div.className = 'gallery-item';
    
    if (/\.(mp4|mov)$/i.test(path)) {
        const video = document.createElement('video');
        video.src = path;
        video.preload = 'metadata';
        video.muted = true;
        video.controls = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.style.display = 'none';
        
        const thumb = document.createElement('div');
        thumb.className = 'thumb';
        
        const img = document.createElement('img');
        img.alt = path.split('/').pop().split('.')[0].replace(/-/g, ' ');
        img.loading = 'lazy';
        // Use pre-generated thumbnail from GitHub
        img.src = path.replace(/\.(mp4|mov)$/i, '.jpg').replace('/images/', '/thumbnails/');
        img.onerror = () => {
            img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M10 9v6l5-3-5-3z"/></svg>';
        };
        
        const playBtn = document.createElement('div');
        playBtn.className = 'play-button';
        
        thumb.appendChild(img);
        thumb.appendChild(playBtn);
        div.appendChild(thumb);
        div.appendChild(video);
        
        div.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            thumb.style.display = 'none';
            video.style.display = 'block';
            
            // iOS Safari specific fix for video playback
            setTimeout(() => {
                video.play().catch(err => console.warn('Video playback error:', err));
            }, 50);
        }, { passive: true });
    } else {
        const link = document.createElement('a');
        link.href = path;
        link.target = '_blank';
        link.rel = 'noopener';
        
        const img = document.createElement('img');
        img.src = path;
        img.alt = path.split('/').pop().split('.')[0].replace(/-/g, ' ');
        img.loading = 'lazy';
        img.onerror = () => {
            img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
            img.alt = 'Failed to load';
        };
        
        link.appendChild(img);
        div.appendChild(link);
    }
    
    return div;
}

function createPaginationNav(totalPages) {
    const nav = document.createElement('nav');
    nav.className = 'pagination';
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', 'Pagination');
    nav.innerHTML = `
        <button ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})" aria-label="Previous page">&larr;</button>
        <span aria-live="polite">${currentPage} / ${totalPages}</span>
        <button ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})" aria-label="Next page">&rarr;</button>
    `;
    return nav;
}

async function loadGallery() {
    const gallery = document.getElementById('gallery');
    gallery.innerHTML = '<div class="loading">Loading...</div>';
    
    try {
        const files = await fetchImages();
        const totalPages = Math.ceil(files.length / itemsPerPage);
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        
        gallery.innerHTML = '';

        // Add top navigation if needed
        if (files.length > itemsPerPage) {
            gallery.appendChild(createPaginationNav(totalPages));
        }
        
        // Add gallery items
        files.slice(start, end).forEach(path => gallery.appendChild(createGalleryItem(path)));
        
        if (files.length === 0) {
            gallery.innerHTML = '<div class="loading">No images found</div>';
        } else if (files.length > itemsPerPage) {
            // Add bottom navigation
            gallery.appendChild(createPaginationNav(totalPages));
        }
    } catch (error) {
        console.error('Error loading gallery:', error);
        gallery.innerHTML = '<div class="loading">Error loading gallery</div>';
    }
}

async function fetchImages() {
    try {
        const response = await fetch('https://api.github.com/repos/evanapplegate/evans_gallery/contents/images');
        if (!response.ok) throw new Error('API request failed');
        
        const files = await response.json();
        return files
            .filter(file => /\.(jpe?g|png|gif|mp4|mov)$/i.test(file.name))
            .map(file => `https://media.githubusercontent.com/media/evanapplegate/evans_gallery/refs/heads/main/images/${file.name}`);
    } catch (error) {
        console.error('Error:', error);
        // Try fallback JSON
        try {
            const fallbackResponse = await fetch('fallback.json');
            if (!fallbackResponse.ok) throw new Error('Fallback not found');
            const { files } = await fallbackResponse.json();
            return files.map(file => 
                `https://media.githubusercontent.com/media/evanapplegate/evans_gallery/refs/heads/main/images/${file}`
            );
        } catch (fallbackError) {
            console.error('Error loading fallback:', fallbackError);
            return [];
        }
    }
}

function changePage(page) {
    currentPage = page;
    loadGallery();
    window.scrollTo(0, 0);
}

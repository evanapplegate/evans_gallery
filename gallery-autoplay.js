document.addEventListener('DOMContentLoaded', () => {
    // Fix for iOS Safari touch events
    document.addEventListener('touchstart', function(){}, {passive: true});
    
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

const MEDIA_URL = 'https://media.githubusercontent.com/media/evanapplegate/evans_gallery/refs/heads/main/images/';
const THUMB_SLOTS = [400, 600, 800];
// Grid is 6 CSS columns, capped at 2000px wide
const THUMB_SIZES = '(min-width: 2000px) 330px, 17vw';
const EAGER_COUNT = 12; // top two rows

// Point an <img> at the WebP grid thumb for `file`, with srcset and real dimensions.
// Returns false if no thumb is listed for it.
function applyThumb(img, file, thumb, index) {
    if (!thumb || !thumb.w.length) return false;
    const base = file.replace(/\.[^.]+$/, '');
    const url = i => `thumbs/${THUMB_SLOTS[i]}/${encodeURIComponent(base)}.webp`;
    const last = thumb.w.length - 1;
    img.src = url(last);
    if (last > 0) {
        img.srcset = thumb.w.map((w, i) => `${url(i)} ${w}w`).join(', ');
        img.sizes = THUMB_SIZES;
    }
    img.width = thumb.w[last];
    img.height = thumb.h;
    img.loading = index < EAGER_COUNT ? 'eager' : 'lazy';
    img.decoding = 'async';
    return true;
}

// Videos load and play only while near the viewport, and pause when scrolled away
const videoObserver = new IntersectionObserver(entries => {
    entries.forEach(({ target: video, isIntersecting }) => {
        if (isIntersecting) {
            if (!video.src) video.src = video.dataset.src;
            video.play().catch(err => console.warn('Video playback error:', err));
        } else if (video.src) {
            video.pause();
        }
    });
}, { rootMargin: '400px 0px' });

function createGalleryItem({ file, url: path, thumb }, index) {
    const div = document.createElement('div');
    div.className = 'gallery-item';
    
    if (/\.(mp4|mov)$/i.test(path)) {
        const video = document.createElement('video');
        video.dataset.src = path;
        video.preload = 'none';
        video.muted = true;
        video.loop = true;
        video.controls = true;
        video.playsInline = true;
        video.setAttribute('loop', '');
        video.setAttribute('muted', '');
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.style.display = 'block';
        if (thumb && thumb.w.length) {
            // Reserve the right box before any video data arrives
            video.width = thumb.w[thumb.w.length - 1];
            video.height = thumb.h;
            video.style.aspectRatio = `${video.width} / ${video.height}`;
        }
        
        div.appendChild(video);
        videoObserver.observe(video);
    } else {
        const link = document.createElement('a');
        link.href = path;
        link.target = '_blank';
        link.rel = 'noopener';
        
        const img = document.createElement('img');
        img.alt = path.split('/').pop().split('.')[0].replace(/-/g, ' ');
        const hasThumb = applyThumb(img, file, thumb, index);
        if (!hasThumb) {
            img.src = path;
            img.loading = 'lazy';
        }
        let triedOriginal = !hasThumb;
        img.onerror = () => {
            // Missing thumb: fall back to the original once
            if (!triedOriginal) {
                triedOriginal = true;
                img.removeAttribute('srcset');
                img.src = path;
                return;
            }
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
    videoObserver.disconnect();
    
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
        files.slice(start, end).forEach((item, i) => gallery.appendChild(createGalleryItem(item, i)));
        
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
        // Try fallback.json first to avoid cross-domain requests
        const fallbackResponse = await fetch('fallback.json');
        if (!fallbackResponse.ok) throw new Error('Fallback not found');
        const { files, thumbs = {} } = await fallbackResponse.json();
        return files.map(file => ({ file, url: MEDIA_URL + file, thumb: thumbs[file] }));
    } catch (fallbackError) {
        console.error('Error loading fallback:', fallbackError);
        
        // Fall back to GitHub API if local file fails
        try {
            const response = await fetch('https://api.github.com/repos/evanapplegate/evans_gallery/contents/images');
            if (!response.ok) throw new Error('API request failed');
            
            const files = await response.json();
            return files
                .filter(file => /\.(jpe?g|png|gif|mp4|mov)$/i.test(file.name))
                .map(file => ({ file: file.name, url: MEDIA_URL + file.name }));
        } catch (error) {
            console.error('Error:', error);
            return [];
        }
    }
}

function changePage(page) {
    currentPage = page;
    loadGallery();
    window.scrollTo(0, 0);
}




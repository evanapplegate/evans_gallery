document.addEventListener('DOMContentLoaded', () => {
    loadGallery();
});

let currentPage = 1;
const itemsPerPage = 50;
let allFiles = [];

async function loadGallery() {
    const gallery = document.getElementById('gallery');
    gallery.innerHTML = '<div class="loading">Loading...</div>';
    
    try {
        const files = await fetchImages();
        const totalPages = Math.ceil(files.length / itemsPerPage);
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        
        gallery.innerHTML = '';
        files.slice(start, end).forEach(path => gallery.appendChild(createGalleryItem(path)));
        
        if (files.length === 0) {
            gallery.innerHTML = '<div class="loading">No images found</div>';
        } else if (files.length > itemsPerPage) {
            const nav = document.createElement('nav');
            nav.className = 'pagination';
            nav.innerHTML = `
                <button ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">&larr;</button>
                <span>${currentPage} / ${totalPages}</span>
                <button ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">&rarr;</button>
            `;
            gallery.appendChild(nav);
        }
    } catch (error) {
        console.error('Error loading gallery:', error);
        gallery.innerHTML = '<div class="loading">Error loading gallery</div>';
    }
}

function createGalleryItem(path) {
    const div = document.createElement('div');
    div.className = 'gallery-item';
    
    if (/\.(mp4|mov)$/i.test(path)) {
        const video = document.createElement('video');
        video.src = path;
        video.preload = 'metadata';
        video.muted = true;
        video.controls = true;
        video.style.display = 'none';
        
        const thumb = document.createElement('div');
        thumb.className = 'thumb';
        
        const img = document.createElement('img');
        img.alt = path.split('/').pop().split('.')[0].replace(/-/g, ' ');
        img.loading = 'lazy';
        
        const playBtn = document.createElement('div');
        playBtn.className = 'play-button';
        
        video.addEventListener('loadedmetadata', () => {
            video.currentTime = 0;
            video.addEventListener('seeked', () => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                canvas.getContext('2d').drawImage(video, 0, 0);
                img.src = canvas.toDataURL();
            }, { once: true });
        });
        
        thumb.appendChild(img);
        thumb.appendChild(playBtn);
        div.appendChild(thumb);
        div.appendChild(video);
        
        div.addEventListener('click', (e) => {
            e.preventDefault();
            thumb.style.display = 'none';
            video.style.display = 'block';
            video.play();
        });
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

async function fetchImages() {
    try {
        const response = await fetch('https://api.github.com/repos/evanapplegate/evans_gallery/contents/images');
        const files = await response.json();
        return files
            .filter(file => /\.(jpe?g|png|gif|mp4|mov)$/i.test(file.name))
            .map(file => `images/${file.name}`);
    } catch (error) {
        console.error('Error fetching images:', error);
        return [];
    }
}

function changePage(page) {
    currentPage = page;
    loadGallery();
    window.scrollTo(0, 0);
}

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
        const files = [
            '106137290_950741895351369_2785590421640695606_n.jpg',
            '106370671_304773590932098_7948076694103571482_n.jpg',
            '173935681_494693768244288_3906053175891981462_n.jpg',
            '174316577_1786753361492680_7975184923832317449_n.jpg',
            '239697528_525367972088239_5620429904857938783_n.jpg',
            '310377770_3312985962315199_68466455150402006_n.jpg',
            '313843793_5638036599589774_5112167168360310674_n.jpg',
            '313851355_678190670297328_3123053017515208487_n.jpg',
            '313852915_1070721593597021_7317912321735823821_n.jpg',
            '313914617_682240856513002_3948867507483724422_n.jpg',
            '315308003_3287643148177091_2400465916820476244_n (1).jpg',
            '53051099_1981302465508196_785357706659864265_n.jpg',
            '90710649_2629894620566159_1866899037223752325_n.jpg',
            '91221882_213090123251041_9116725117342699283_n.jpg',
            '91730101_667353620665649_734802778642280718_n.jpg',
            '94387080_154212372758061_1334169763300600368_n.jpg',
            'out2.mp4'
        ];
        return files.map(file => 
            `https://media.githubusercontent.com/media/evanapplegate/evans_gallery/refs/heads/main/images/${file}`
        );
    } catch (error) {
        console.error('Error:', error);
        return [];
    }
}

function changePage(page) {
    currentPage = page;
    loadGallery();
    window.scrollTo(0, 0);
}

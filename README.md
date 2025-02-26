# Image Gallery

A clean, responsive image gallery that uses GitHub for storage. Built with vanilla JavaScript and CSS Grid.

## Features

- Responsive grid layout
- Lazy loading images
- Dark theme
- Hover effects
- Mobile-friendly

## Setup

1. Clone this repository:
```bash
git clone <your-repo-url>
cd evans_gallery
```

2. Add images to the `images` directory:
- Keep files under 50MB each
- Supported formats: jpg, jpeg, png, gif
- Images are handled by Git LFS

3. Push to GitHub:
```bash
git add .
git commit -m "Add images"
git push origin main
```

## Development

Run locally:
```bash
python -m http.server 8000
```
Then visit `http://localhost:8000`

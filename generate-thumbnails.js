const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

const videoDir = path.join(__dirname, 'images');
const thumbDir = path.join(__dirname, 'thumbnails');

// Create thumbnails directory if it doesn't exist
if (!fs.existsSync(thumbDir)) {
    fs.mkdirSync(thumbDir);
}

// Get all video files
const videoFiles = fs.readdirSync(videoDir).filter(file => /\.(mp4|mov)$/i.test(file));

videoFiles.forEach(videoFile => {
    const videoPath = path.join(videoDir, videoFile);
    const thumbName = videoFile.replace(/\.(mp4|mov)$/i, '.jpg');
    const thumbPath = path.join(thumbDir, thumbName);

    // Use ffmpeg to extract first frame
    const cmd = `ffmpeg -i "${videoPath}" -vframes 1 -f image2 "${thumbPath}"`;
    
    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error generating thumbnail for ${videoFile}:`, error);
            return;
        }
        console.log(`Generated thumbnail for ${videoFile}`);
    });
});

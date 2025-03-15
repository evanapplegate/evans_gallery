#!/usr/bin/env python3
"""
Generate a collage with images arranged by hue.
Warm colors (orange/red) in top-left, cool colors (blue/green) in bottom-right.
"""

import os
import sys
import json
import colorsys
import math
import numpy as np
from PIL import Image, ImageDraw
import random
from concurrent.futures import ProcessPoolExecutor, as_completed

def get_warmth_value(hue):
    """
    Convert hue to a warmth value where:
    - Reds/oranges (0-30°) are warmest
    - Yellows (30-60°) next warmest
    - Greens (60-180°) neutral
    - Blues (180-240°) cool
    - Purples (240-300°) neutral-ish
    - Magentas (300-360°) warm
    
    Returns value where higher = warmer
    """
    # Normalize any hue to 0-360 range
    hue = hue % 360
    
    # Define warmth for hue ranges
    if 0 <= hue < 30:
        # Red to orange - warmest
        warmth_value = 1000 + (30 - hue)
    elif 30 <= hue < 60:
        # Orange to yellow
        warmth_value = 970 + (60 - hue)
    elif 60 <= hue < 180:
        # Yellow to green to cyan
        warmth_value = 940 - (hue - 60)
    elif 180 <= hue < 240:
        # Cyan to blue - coolest
        warmth_value = 820 - ((hue - 180) * 1.5)
    elif 240 <= hue < 300:
        # Blue to magenta
        warmth_value = 730 - ((hue - 240) * 0.5)
    else:  # 300-360
        # Magenta to red
        warmth_value = 730 + ((hue - 300) * 0.9)
        
    return warmth_value

def calculate_hue(image_path):
    """
    Calculate the average hue of an image with proper weighting.
    
    We need to:
    1. Skip pixels that are near gray (low saturation)
    2. Weight by saturation and value for better color accuracy
    3. Handle the circular nature of hue (avg of 359° and 1° should be 0°, not 180°)
    """
    try:
        with Image.open(image_path) as img:
            # Convert image to RGB if needed
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Resize for faster processing
            img.thumbnail((100, 100))
            
            # Get pixel data
            pixels = list(img.getdata())
            
            # Calculate weighted average hue
            x_sum = 0  # Sum of cos(hue) * sat * val
            y_sum = 0  # Sum of sin(hue) * sat * val
            weight_sum = 0
            pixel_colors = []
            
            for r, g, b in pixels:
                # Convert RGB to HSV
                h, s, v = colorsys.rgb_to_hsv(r/255, g/255, b/255)
                h *= 360  # Convert to 0-360 degrees
                
                # Skip near-gray pixels (low saturation or low value)
                if s < 0.1 or v < 0.1:
                    continue
                
                # Store for calculating average color
                pixel_colors.append((r, g, b, s, v))
                
                # Weight by saturation and value for better color accuracy
                weight = s * v
                
                # Handle circular nature of hue using polar coordinates
                angle_rad = math.radians(h)
                x_sum += math.cos(angle_rad) * weight
                y_sum += math.sin(angle_rad) * weight
                weight_sum += weight
            
            # No valid pixels
            if weight_sum == 0:
                return {
                    'path': image_path,
                    'hue': 0,
                    'warmth': get_warmth_value(0)
                }
            
            # Calculate the average angle
            avg_h_rad = math.atan2(y_sum, x_sum)
            avg_hue = (math.degrees(avg_h_rad) + 360) % 360
            
            # Calculate average RGB for color dot display
            if pixel_colors:
                avg_r = sum(p[0] * p[3] * p[4] for p in pixel_colors) / sum(p[3] * p[4] for p in pixel_colors)
                avg_g = sum(p[1] * p[3] * p[4] for p in pixel_colors) / sum(p[3] * p[4] for p in pixel_colors)
                avg_b = sum(p[2] * p[3] * p[4] for p in pixel_colors) / sum(p[3] * p[4] for p in pixel_colors)
                avg_color = (int(avg_r), int(avg_g), int(avg_b))
            else:
                avg_color = (128, 128, 128)
            
            # Calculate warmth for sorting
            warmth = get_warmth_value(avg_hue)
            
            return {
                'path': image_path,
                'hue': float(avg_hue),
                'warmth': float(warmth),
                'avg_color': avg_color
            }
    except Exception as e:
        print(f"Error processing {image_path}: {e}")
        return {
            'path': image_path,
            'hue': 0,
            'warmth': get_warmth_value(0)
        }

def create_hue_collage(sorted_images, output_path):
    """
    Create a collage of images arranged by hue.
    Warmest (orange/red) in top-left, coolest (blue/green) in bottom-right.
    Using a column-based layout with variable aspect ratios.
    """
    # Check if we have any images
    if not sorted_images:
        print("No images found to create collage")
        return None
        
    # Set collage dimensions and scaling
    FINAL_SIZE = 4000   # Base size for square result (doubled)
    PADDING = 4         # Tighter spacing between images (doubled)
    BG_COLOR = (21, 32, 43)  # Dark blue background (#15202B)
    
    # For debugging - print some images with their hue values
    for idx, img in enumerate(sorted_images[:10]):
        print(f"Top image {idx+1}: {os.path.basename(img['path'])}, hue: {img['hue']:.1f}, warmth: {img['warmth']:.1f}")
    
    print("\nBottom images:")
    for idx, img in enumerate(sorted_images[-10:]):
        print(f"Bottom image {idx+1}: {os.path.basename(img['path'])}, hue: {img['hue']:.1f}, warmth: {img['warmth']:.1f}")
    
    # Calculate number of images and column layout
    num_images = len(sorted_images)
    if num_images == 0:
        print("No images to arrange in a grid")
        return None
        
    # Use more columns than before for a layout that resembles the target image
    num_cols = int(math.sqrt(num_images) * 1.1)  # Fewer, wider columns
    images_per_col = math.ceil(num_images / num_cols)
    
    print(f"Using {num_cols} columns with ~{images_per_col} images per column")
    
    # Calculate column width
    col_width = (FINAL_SIZE - ((num_cols + 1) * PADDING)) // num_cols
    
    # Assign images to columns
    columns = [[] for _ in range(num_cols)]
    col_idx = 0
    
    # First, distribute images to columns
    for i, img_data in enumerate(sorted_images):
        columns[col_idx].append(img_data)
        col_idx = (col_idx + 1) % num_cols
    
    # Calculate heights for each image and total column heights
    column_heights = [0] * num_cols
    image_sizes = {}  # (col, position_in_col) -> (width, height)
    
    for col in range(num_cols):
        for pos, img_data in enumerate(columns[col]):
            try:
                with Image.open(img_data['path']) as img:
                    img_width, img_height = img.size
                    # Allow much more variation in aspect ratios
                    aspect_ratio = img_height / img_width
                    
                    # Add some randomness to aspect ratios to create variety
                    # Use the image's hue value to influence aspect ratio
                    hue_factor = (img_data.get('hue', 180) % 360) / 360.0
                    
                    # More dramatic aspect ratio range, especially for portrait images
                    if aspect_ratio > 1:  # Portrait
                        # Allow some images to be very tall
                        if random.random() < 0.3:  # 30% chance for taller image
                            aspect_ratio = min(max(aspect_ratio, 0.5), 4.0)
                        else:
                            aspect_ratio = min(max(aspect_ratio, 0.5), 2.0)
                    else:  # Landscape
                        # Allow some images to be very wide
                        if random.random() < 0.2:  # 20% chance for wider image
                            aspect_ratio = min(max(aspect_ratio, 0.33), 1.2)
                        else:
                            aspect_ratio = min(max(aspect_ratio, 0.5), 1.2)
                    
                    target_width = col_width
                    target_height = int(target_width * aspect_ratio)
                    
                    # Store the image size
                    image_sizes[(col, pos)] = (target_width, target_height)
                    
                    # Update column height
                    column_heights[col] += target_height + PADDING
            except Exception as e:
                # Handle errors with a default size
                image_sizes[(col, pos)] = (col_width, col_width)
                column_heights[col] += col_width + PADDING
                print(f"Error sizing {img_data['path']}: {e}")
    
    # Calculate canvas dimensions
    collage_width = (col_width * num_cols) + ((num_cols + 1) * PADDING)
    collage_height = max(column_heights) + PADDING
    
    # Create initial canvas
    canvas = Image.new('RGB', (collage_width, collage_height), BG_COLOR)
    draw = ImageDraw.Draw(canvas)
    
    # Place images on the canvas
    for col in range(num_cols):
        # Start at the top of each column
        y_pos = PADDING
        
        for pos, img_data in enumerate(columns[col]):
            # Calculate x position for this column
            x_pos = PADDING + (col * (col_width + PADDING))
            
            # Get image dimensions
            target_width, target_height = image_sizes.get((col, pos), (col_width, col_width))
            
            try:
                with Image.open(img_data['path']) as img:
                    # Convert to RGB mode if needed
                    if img.mode != 'RGB':
                        img = img.convert('RGB')
                    
                    # Resize preserving aspect ratio
                    img_resized = img.resize((target_width, target_height), Image.Resampling.LANCZOS)
                    
                    # Paste image
                    canvas.paste(img_resized, (x_pos, y_pos))
                    
                    # Draw border
                    draw.rectangle(
                        [(x_pos, y_pos), (x_pos + target_width - 1, y_pos + target_height - 1)],
                        outline=(30, 30, 30), width=1
                    )
                    
                    # Add color indicator in corner
                    hue = img_data.get('hue', 0)
                    
                    # Get the average color that was calculated
                    if 'avg_color' in img_data:
                        indicator_color = img_data['avg_color']
                    else:
                        # Convert hue to RGB if we don't have avg_color
                        h = hue / 360.0
                        s = 0.9  # High saturation
                        v = 0.9  # Good brightness
                        
                        rgb = colorsys.hsv_to_rgb(h, s, v)
                        indicator_color = (int(rgb[0] * 255), int(rgb[1] * 255), int(rgb[2] * 255))
                    
                    # Draw indicator dot - top right corner
                    dot_size = 5
                    draw.rectangle(
                        [(x_pos + target_width - dot_size - 2, y_pos + 2), 
                         (x_pos + target_width - 2, y_pos + dot_size + 2)],
                        fill=indicator_color, outline=None
                    )
                    
                    # Update y position for next image
                    y_pos += target_height + PADDING
                    
            except Exception as e:
                print(f"Error placing {img_data['path']}: {e}")
                # Skip to next position
                y_pos += target_height + PADDING
    
    # Print final dimensions
    print(f"Final collage dimensions: {collage_width}×{collage_height} pixels")
    
    # Save the final collage
    canvas.save(output_path, quality=95)
    print(f"Collage saved to {output_path}")
    return output_path

def main():
    # Define paths
    if len(sys.argv) > 1:
        directory = sys.argv[1]
    else:
        # Default to parent directory of scripts (the main project dir)
        # This fixes the issue when running the script inside the scripts directory
        current_dir = os.getcwd()
        # If we're in a scripts directory, go up one level
        if os.path.basename(current_dir) == 'scripts':
            directory = os.path.dirname(current_dir)
        else:
            directory = current_dir
    
    # Set output in the same directory as the input
    output_path = os.path.join(directory, 'hue_collage.jpg')
    
    print(f"Creating collage in {output_path}")
    print(f"Processing thumbnails in {directory}")
    
    # Find images
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
    image_paths = []
    
    for root, _, files in os.walk(directory):
        for file in files:
            if os.path.splitext(file.lower())[1] in image_extensions:
                image_path = os.path.join(root, file)
                image_paths.append(image_path)
    
    print(f"Found {len(image_paths)} thumbnails")
    
    # Calculate hue for all images
    image_data = []
    with ProcessPoolExecutor() as executor:
        future_to_path = {executor.submit(calculate_hue, path): path for path in image_paths}
        for future in as_completed(future_to_path):
            result = future.result()
            if result:
                image_data.append(result)
    
    # Sort images by warmth (warm to cool)
    sorted_images = sorted(image_data, key=lambda x: -x['warmth'])
    print(f"Sorted {len(sorted_images)} images by hue")
    
    # Create the collage
    create_hue_collage(sorted_images, output_path)
    print(f"Created hue-sorted collage at {output_path}")

if __name__ == "__main__":
    main()

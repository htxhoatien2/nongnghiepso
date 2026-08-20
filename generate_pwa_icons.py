import os
from PIL import Image, ImageDraw

os.makedirs('app/icons', exist_ok=True)

def create_icon(size, filename, is_maskable=False):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    margin = int(size * 0.05) if not is_maskable else 0
    bg_box = [margin, margin, size - margin, size - margin]
    
    if is_maskable:
        draw.rectangle([0, 0, size, size], fill=(5, 150, 105, 255))
    else:
        draw.ellipse(bg_box, fill=(5, 150, 105, 255))
    
    inner_margin = margin + int(size * 0.04)
    if not is_maskable:
        draw.ellipse([inner_margin, inner_margin, size - inner_margin, size - inner_margin], outline=(245, 158, 11, 200), width=max(2, int(size * 0.02)))
    
    center_x = size // 2
    center_y = size // 2
    
    stem_width = max(3, int(size * 0.04))
    stem_bottom = int(center_y + size * 0.22)
    stem_top = int(center_y - size * 0.15)
    
    draw.line([center_x, stem_bottom, center_x, stem_top], fill=(255, 255, 255, 255), width=stem_width)
    
    left_leaf_box = [center_x - int(size * 0.25), center_y - int(size * 0.18), center_x, center_y + int(size * 0.05)]
    draw.pieslice(left_leaf_box, start=180, end=360, fill=(255, 255, 255, 240))
    
    right_leaf_box = [center_x, center_y - int(size * 0.18), center_x + int(size * 0.25), center_y + int(size * 0.05)]
    draw.pieslice(right_leaf_box, start=180, end=360, fill=(245, 158, 11, 255))
    
    grain_box = [center_x - int(size * 0.08), center_y - int(size * 0.32), center_x + int(size * 0.08), center_y - int(size * 0.14)]
    draw.ellipse(grain_box, fill=(245, 158, 11, 255))
    
    filepath = os.path.join('app/icons', filename)
    img.save(filepath, 'PNG')
    print(f"Generated {filepath} ({size}x{size})")

create_icon(192, 'icon-192.png')
create_icon(512, 'icon-512.png')
create_icon(512, 'icon-maskable-512.png', is_maskable=True)
create_icon(180, 'apple-touch-icon.png')
print("All PWA icons created successfully!")

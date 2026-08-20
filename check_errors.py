import os
import glob
import subprocess
import html.parser
import sys

# Ensure UTF-8 output on Windows console
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

print("==================================================")
print("  KIỂM TRA LỖI TOÀN BỘ DỰ ÁN (KHÔNG CẦN TRÌNH DUYỆT)")
print("==================================================")

# 1. Check JS syntax with Node.js
print("\n[1] KIỂM TRA CÚ PHÁP JAVASCRIPT:")
js_files = glob.glob('app/js/*.js')
for f in js_files:
    try:
        res = subprocess.run(['node', '--check', f], capture_output=True, text=True)
        if res.returncode == 0:
            print(f"  ✓ {f:<25} : Hợp lệ 100%")
        else:
            print(f"  ✗ {f:<25} : LỖI CÚ PHÁP:")
            print(res.stderr)
    except Exception as e:
        print(f"  ? Không gọi được node: {e}")

# 2. Check HTML structure and matching tags
print("\n[2] KIỂM TRA CẤU TRÚC THẺ HTML (INDEX.HTML):")
with open('app/index.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

class TagValidator(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []
        self.void_tags = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}
        self.errors = []

    def handle_starttag(self, tag, attrs):
        if tag not in self.void_tags:
            self.stack.append((tag, self.getpos()))

    def handle_endtag(self, tag):
        if tag in self.void_tags:
            return
        if not self.stack:
            self.errors.append(f"Thẻ đóng </{tag}> thừa tại dòng {self.getpos()[0]}")
            return
        last_tag, pos = self.stack.pop()
        if last_tag != tag:
            self.errors.append(f"Lỗi đóng thẻ: Mở <{last_tag}> tại dòng {pos[0]} nhưng đóng </{tag}> tại dòng {self.getpos()[0]}")

parser = TagValidator()
parser.feed(html_content)

if parser.errors:
    print(f"  ✗ Phát hiện {len(parser.errors)} lỗi cấu trúc HTML:")
    for err in parser.errors[:10]:
        print(f"    - {err}")
else:
    print("  ✓ Cấu trúc thẻ HTML index.html chuẩn xác, không có thẻ mở/đóng lệch!")

# 3. Check Tab IDs
print("\n[3] KIỂM TRA CÁC PHÂN HỆ TAB CHÍNH:")
tabs = ['tab-map', 'tab-plots', 'tab-farmers', 'tab-services', 'tab-purchasing', 'tab-analytics', 'tab-admin']
for t in tabs:
    if f'id="{t}"' in html_content:
        print(f"  ✓ Phân hệ '{t:<15}' : Có mặt và sẵn sàng")
    else:
        print(f"  ✗ Phân hệ '{t:<15}' : THIẾU THẺ TRONG DOM")

print("\n==================================================")
print("  KẾT QUẢ: TẤT CẢ FILE ĐÃ ĐƯỢC KIỂM TRA HOÀN TẤT!")
print("==================================================")

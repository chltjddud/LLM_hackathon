with open(r'shield-web/src/app/session/[id]/page.tsx', encoding='utf-8') as f:
    lines = f.readlines()

# Lines 755-768 (0-indexed 754-767) are the misplaced duplicate block
# Remove them
new_lines = lines[:754] + lines[769:]

with open(r'shield-web/src/app/session/[id]/page.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("DONE. New total lines:", len(new_lines))

# Verify what's around that position now
for i, line in enumerate(new_lines[750:765], start=751):
    print(f"{i}: {repr(line)}")

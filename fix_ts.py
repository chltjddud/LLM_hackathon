import re

file_path = r"c:\Users\chltj\Documents\GitHub\LLM_hackathon\shield-web\src\app\session\[id]\page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("activeTab === 'contracts'", "(activeTab as any) === 'contracts'")
content = content.replace("activeTab === 'chat'", "(activeTab as any) === 'chat'")
content = content.replace("activeTab === 'sign'", "(activeTab as any) === 'sign'")
content = content.replace("(activeTab as string) === 'chat'", "(activeTab as any) === 'chat'")
content = content.replace("(activeTab as string) === 'contracts'", "(activeTab as any) === 'contracts'")

old_submit_end = """      if (!res.ok) throw new Error('서명 제출 실패');
      clearCanvas();
    } catch (err) {"""
new_submit_end = """      if (!res.ok) throw new Error('서명 제출 실패');
      clearCanvas();
      window.location.href = `/session/${id}/complete`;
    } catch (err) {"""
content = content.replace(old_submit_end, new_submit_end)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("TS fix done.")

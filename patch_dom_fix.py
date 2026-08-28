with open(r'shield-web/src/app/session/[id]/page.tsx', encoding='utf-8') as f:
    content = f.read()

# 1. Remove the hidden RevisedContractDocument from the 'sign' tab block
target_old = '<RevisedContractDocument clauses={clauses} sessionDate={session?.created_at} imageUrl={session?.image_url} hidden={true} previewMode={true} />'

# First check how many times it appears. If we just remove it inside the tab check,
# we need to be precise.
# Let's find:
#                  </div>
#                  <RevisedContractDocument clauses={clauses} sessionDate={session?.created_at} imageUrl={session?.image_url} hidden={true} previewMode={true} />
#                </div>
#              )}

old_sign_tab_end = """                 </div>
                 <RevisedContractDocument clauses={clauses} sessionDate={session?.created_at} imageUrl={session?.image_url} hidden={true} previewMode={true} />
               </div>
             )}"""

new_sign_tab_end = """                 </div>
               </div>
             )}"""

if old_sign_tab_end in content:
    content = content.replace(old_sign_tab_end, new_sign_tab_end)
else:
    # If the formatting is slightly different, let's do a direct replace of the first occurrence of the hidden component
    idx = content.find(target_old)
    if idx != -1:
        # We need to make sure we don't remove the one we just placed in showWebPreview.
        # But target_old has hidden={true}, whereas the web preview one has hidden={false}.
        # So we can safely remove target_old.
        content = content.replace(target_old, "", 1)

# 2. Append the hidden RevisedContractDocument at the very bottom of the <main> container (always in DOM)
bottom_insert = """
          <RevisedContractDocument clauses={clauses} sessionDate={session?.created_at} imageUrl={session?.image_url} hidden={true} previewMode={true} />
       </main>"""

content = content.replace("       </main>", bottom_insert)

with open(r'shield-web/src/app/session/[id]/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Moved hidden RevisedContractDocument to the bottom of the main layout.")

with open(r'shield-web/src/app/session/[id]/page.tsx', encoding='utf-8') as f:
    content = f.read()

# 1. Add currentUser state
state_import = "  const [currentUser, setCurrentUser] = useState<any>(null);\n"
if "setCurrentUser" not in content:
    idx = content.find("const [session, setSession] = useState<any>(null);")
    content = content[:idx] + state_import + content[idx:]

# 2. Add getUser logic in useEffect
get_user_logic = """
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
      }
    };
    fetchUser();
"""
if "fetchUser()" not in content:
    idx = content.find("const fetchData = async () => {")
    content = content[:idx] + get_user_logic + "\n    " + content[idx:]

# 3. Modify the rendering of participant names
# Old lines:
# <span className="text-[15px] font-bold text-gray-800">홍길동(임차인)</span>
# <span className="text-[15px] font-bold text-gray-800">00공인중개사(임대인 대리)</span>

# Replace tenant name
tenant_old = '<span className="text-[15px] font-bold text-gray-800">홍길동(임차인)</span>'
tenant_new = '<span className="text-[15px] font-bold text-gray-800">{role === "tenant" && currentUser ? (currentUser.user_metadata?.user_name || currentUser.user_metadata?.full_name || currentUser.email?.split("@")[0]) : "상대방"}(임차인)</span>'
content = content.replace(tenant_old, tenant_new)

# Replace landlord name
landlord_old = '<span className="text-[15px] font-bold text-gray-800">00공인중개사(임대인 대리)</span>'
landlord_new = '<span className="text-[15px] font-bold text-gray-800">{role === "landlord" && currentUser ? (currentUser.user_metadata?.user_name || currentUser.user_metadata?.full_name || currentUser.email?.split("@")[0]) : "상대방"}(임대인)</span>'
content = content.replace(landlord_old, landlord_new)

with open(r'shield-web/src/app/session/[id]/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated session page with user names")

import os
import zipfile

def zipdir(path, ziph):
    for root, dirs, files in os.walk(path):
        if 'node_modules' in dirs:
            dirs.remove('node_modules')
        if '.next' in dirs:
            dirs.remove('.next')
        if '.git' in dirs:
            dirs.remove('.git')
        for file in files:
            if file.endswith('.env') or file.endswith('.env.local') or file.endswith('.pem') or file.endswith('.key') or file == '.env.local':
                continue
            ziph.write(os.path.join(root, file),
                       os.path.relpath(os.path.join(root, file),
                                       os.path.join(path, '..')))

with zipfile.ZipFile('shield-web.zip', 'w', zipfile.ZIP_DEFLATED) as zipf:
    zipdir('shield-web', zipf)
print("Zip created.")

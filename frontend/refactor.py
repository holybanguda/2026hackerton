import re

app_path = 'd:/2026hackerton/frontend/app.js'
with open(app_path, 'r', encoding='utf-8') as f:
    js = f.read()

if 'const BASE_URL' not in js:
    js = js.replace('const navIcons', 'const BASE_URL = \'http://localhost:8080\';\nconst navIcons')
    
js = re.sub(r'[\'\"]http://localhost:8080(/.*?)[\'\"]', r'${BASE_URL}\g<1>', js)

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(js)

print('app.js updated.')

import re

html_path = 'd:/2026hackerton/frontend/index.html'
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Replace wine emoji with image
html = html.replace('<b>🍷</b>', '<b><img src="assets/wine-glass.png" alt="와인" /></b>')

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)

css_path = 'd:/2026hackerton/frontend/styles.css'
with open(css_path, 'r', encoding='utf-8') as f:
    css = f.read()

# Fix grid-template-rows in article to allow text wrapping without overlap
css = css.replace(
    '#result-screen .menu-list article { display:grid; grid-template-columns:80px minmax(0,1fr) auto; grid-template-rows:22px 21px 19px; column-gap:16px; row-gap:3px; }',
    '#result-screen .menu-list article { display:grid; grid-template-columns:80px minmax(0,1fr) auto; grid-template-rows:auto 21px 19px; column-gap:16px; row-gap:3px; }'
)

# Also ensure b is centered for emojis
css = css.replace(
    '#result-screen .menu-list article>b{width:80px;height:80px;border-radius:8px;background:#f6f4f5;color:#b2afac;font-size:18px}',
    '#result-screen .menu-list article>b{width:80px;height:80px;border-radius:8px;background:#f6f4f5;color:#b2afac;font-size:32px;display:flex;justify-content:center;align-items:center;}'
)

# And add some padding to the image so it's not sticking to the edges of the 80x80 box
css = css.replace(
    '#result-screen .menu-list article > b img { width:100%; height:100%; object-fit:contain; border-radius:8px; }',
    '#result-screen .menu-list article > b img { width:100%; height:100%; object-fit:contain; border-radius:8px; padding:12px; }'
)

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(css)

print('Fixed wine icon and line-height')

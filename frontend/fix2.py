import re

html_path = 'd:/2026hackerton/frontend/index.html'
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Replace <button id="back-button"...>‹</button>
html = re.sub(
    r'<button id="back-button" aria-label="[^"]+">‹</button>',
    r'<button id="back-button" class="back-button" aria-label="뒤로 가기"><img src="assets/icon-chevron-left.svg" alt="<" /></button>',
    html
)

# Replace <button id="result-back">‹</button>
html = re.sub(
    r'<button id="result-back">‹</button>',
    r'<button id="result-back" class="back-button" aria-label="뒤로 가기"><img src="assets/icon-chevron-left.svg" alt="<" /></button>',
    html
)

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)

css_path = 'd:/2026hackerton/frontend/styles.css'
with open(css_path, 'r', encoding='utf-8') as f:
    css = f.read()

css_append = '''
/* --- Additional Fixes --- */
button, .back-button, .scan-header button {
  user-select: none;
  -webkit-user-select: none;
}

.food-card {
  transition: all 0.25s ease-in-out !important;
}
.food-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}
.food-card:focus-visible, .food-input:focus-visible {
  outline: 2px solid var(--coral) !important;
  outline-offset: 2px;
}
'''
with open(css_path, 'a', encoding='utf-8') as f:
    f.write(css_append)

print("Fixes applied successfully")

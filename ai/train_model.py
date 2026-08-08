import os
import json
import pickle
import pandas as pd
from kiwipiepy import Kiwi
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report, accuracy_score

print("==================================================================")
print("[Train/Val Split] 7:3 Ratio Dataset Split & AI Model Evaluation")
print("==================================================================")

base_dir = os.path.dirname(__file__)
workspace_dir = os.path.dirname(base_dir)

# 1. 초경량 C++ 한국어 형태소 분석기 Kiwi 초기화
kiwi = Kiwi()

def kiwi_tokenizer(text: str):
    tokens = []
    for token in kiwi.tokenize(str(text)):
        if token.tag in ('NNG', 'NNP', 'XR', 'SL'):
            tokens.append(token.form)
    return tokens if tokens else str(text).split()

# 2. 3대 원천 데이터셋 융합 코퍼스 로드
training_rows = []

# (1) v4 합성 데이터셋 (9,244건 메뉴)
v4_path = os.path.join(workspace_dir, "json", "korean_restaurant_menu_dataset_150_v4.json")
if os.path.exists(v4_path):
    print(f"[Info 1/2] v4 Dataset Loading: {v4_path}")
    with open(v4_path, "r", encoding="utf-8") as f:
        v4_data = json.load(f)
        for rest in v4_data.get("restaurants", []):
            for menu in rest.get("menu_list", []):
                training_rows.append({
                    "menu_name": menu.get("menu_name", ""),
                    "category": menu.get("menu_type", "MAIN")
                })

# (2) 19,495건 음식 영양성분 룩업 데이터 (food_lookup.json)
food_lookup_path = os.path.join(base_dir, "food_lookup.json")
if os.path.exists(food_lookup_path):
    print(f"[Info 2/2] Food Nutrition Lookup DB Loading: {food_lookup_path}")
    with open(food_lookup_path, "r", encoding="utf-8") as f:
        food_lookup = json.load(f)
        for fname, fmeta in food_lookup.items():
            training_rows.append({
                "menu_name": fname,
                "category": fmeta.get("category", "MAIN")
            })

df_total = pd.DataFrame(training_rows).drop_duplicates(subset=["menu_name"])
print(f"[Data Loaded] Total Unique Cleaned Samples: {len(df_total):,}")

# 3. 데이터셋 7:3 엄격 분할 (Train 70% : Validation 30%)
X = df_total["menu_name"]
y = df_total["category"]

X_train, X_val, y_train, y_val = train_test_split(
    X, y, test_size=0.30, random_state=42, stratify=y
)

print(f"\n[Dataset Split Ratio 7:3]")
print(f"  * Train Set (70%): {len(X_train):,} items")
print(f"  * Validation Set (30%): {len(X_val):,} items")

# 4. Kiwi 형태소 + TF-IDF + MultinomialNB 파이프라인 학습 (Train 70%만 학습!)
model_pipeline = Pipeline([
    ('tfidf', TfidfVectorizer(tokenizer=kiwi_tokenizer, ngram_range=(1, 2))),
    ('clf', MultinomialNB(alpha=0.1))
])

print("\n[Training] Training Pipeline on Train Set (70%)...")
model_pipeline.fit(X_train, y_train)

# 5. 검증 데이터셋(Validation 30%) 성능 평가 (Zero-Data Leakage!)
train_acc = accuracy_score(y_train, model_pipeline.predict(X_train)) * 100
val_acc = accuracy_score(y_val, model_pipeline.predict(X_val)) * 100

print("\n==================================================================")
print("[AI Model Evaluation Results (7:3 Split)]")
print("==================================================================")
print(f"  * Train Accuracy:      {train_acc:.2f}%")
print(f"  * Validation Accuracy: {val_acc:.2f}%")
print("------------------------------------------------------------------")

# 상세 클래스별 Precision / Recall / F1-Score 보고
y_val_pred = model_pipeline.predict(X_val)
report = classification_report(y_val, y_val_pred)
print("[Category Validation Report]")
print(report)

# 6. 최종 검증 완료 모델 락커(.pkl) 저장
model_path = os.path.join(base_dir, "menu_classifier.pkl")
with open(model_path, "wb") as f:
    pickle.dump(model_pipeline, f)

model_size_mb = os.path.getsize(model_path) / (1024 * 1024)
print(f"[Model Export] Validated Model Saved: {model_path} ({model_size_mb:.2f} MB)")
print("==================================================================")

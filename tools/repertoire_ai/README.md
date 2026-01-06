# Jacla Repertoire AI（ローカル運用）

最終課題向けの **CSV + Python** で完結する最小構成です。Portal本体とは独立して動かします。

## 1. 事前準備

```bash
cd tools/repertoire_ai
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

## 2. 学習データ（CSV）

`data/songs_template.csv` をコピーして作成します。

- 必須列: `id,title,artist,memo,genre`
- 行数目標: 最低200行（できれば500行以上）
- ジャンル: 6〜8種類程度

## 3. 学習・評価

```bash
python train.py --csv data/songs.csv
```

出力:
- `models/model.joblib`
- `outputs/metrics.json`
- `outputs/confusion_matrix.png`
- `outputs/labels.txt`

分類器は `svm`（Linear SVM）を既定にしています。
必要なら `--algorithm logreg` / `--algorithm nb` を指定できます。

## 4. 予測

```bash
python predict.py --model models/model.joblib --title "宝島" --artist "T-Square" --memo "定番曲"
```

JSONで `predicted_genre` / `confidence` / `top_k` を返します。

## 5. 類似曲検索

```bash
# 曲IDを基準に類似曲
python similar.py --csv data/songs.csv --id 12 --top-n 5

# 自由文で類似曲
python similar.py --csv data/songs.csv --query "爽やか ジャズ フュージョン" --top-n 5
```

## 6. 注意事項

- CSVはUTF-8で保存してください。
- 低データ量だと精度が不安定になります。
- 評価指標は課題提出用の参考値です。

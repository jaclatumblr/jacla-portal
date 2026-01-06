from __future__ import annotations

from typing import Tuple, List

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split

REQUIRED_COLUMNS = ["title", "artist", "memo", "genre"]


def build_text_frame(df: pd.DataFrame) -> pd.DataFrame:
    for col in REQUIRED_COLUMNS:
        if col not in df.columns:
            raise ValueError(f"Missing column: {col}")

    df = df.copy()
    df["title"] = df["title"].fillna("")
    df["artist"] = df["artist"].fillna("")
    df["memo"] = df["memo"].fillna("")
    df["genre"] = df["genre"].fillna("").astype(str).str.strip()

    df["text"] = (
        df["title"].astype(str)
        + " "
        + df["artist"].astype(str)
        + " "
        + df["memo"].astype(str)
    ).str.strip()

    df = df[(df["genre"] != "") & (df["text"] != "")]
    return df


def load_csv(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    return build_text_frame(df)


def build_vectorizer() -> TfidfVectorizer:
    return TfidfVectorizer(max_features=5000, ngram_range=(1, 2))


def split_train_test(
    texts: pd.Series,
    labels: pd.Series,
    test_size: float,
    seed: int,
) -> Tuple[pd.Series, pd.Series, pd.Series, pd.Series]:
    try:
        return train_test_split(
            texts,
            labels,
            test_size=test_size,
            random_state=seed,
            stratify=labels,
        )
    except ValueError:
        return train_test_split(
            texts,
            labels,
            test_size=test_size,
            random_state=seed,
            stratify=None,
        )


def top_k_from_scores(labels: List[str], scores, k: int) -> List[dict]:
    pairs = list(zip(labels, scores))
    pairs.sort(key=lambda x: x[1], reverse=True)
    return [
        {"genre": label, "score": float(score)}
        for label, score in pairs[:k]
    ]

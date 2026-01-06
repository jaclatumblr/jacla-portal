import argparse
import json

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from utils import build_vectorizer, load_csv


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Find similar songs")
    parser.add_argument("--csv", required=True, help="Path to CSV")
    parser.add_argument("--id", default="", help="Song id to use as query")
    parser.add_argument("--query", default="", help="Free text query")
    parser.add_argument("--top-n", type=int, default=10)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    df = load_csv(args.csv)
    if df.empty:
        raise SystemExit("No valid rows found in CSV.")

    vectorizer = build_vectorizer()
    matrix = vectorizer.fit_transform(df["text"])

    query_vec = None
    exclude_idx = None

    if args.id:
        if "id" not in df.columns:
            raise SystemExit("CSV must include 'id' column when using --id.")
        matches = df.index[df["id"].astype(str) == str(args.id)].tolist()
        if not matches:
            raise SystemExit("No matching id found in CSV.")
        exclude_idx = matches[0]
        query_vec = matrix[exclude_idx]
    else:
        query_text = args.query.strip()
        if not query_text:
            raise SystemExit("Provide --id or --query.")
        query_vec = vectorizer.transform([query_text])

    scores = cosine_similarity(query_vec, matrix).flatten()
    if exclude_idx is not None:
        scores[exclude_idx] = -1.0

    top_indices = np.argsort(scores)[::-1][: args.top_n]
    results = []
    for idx in top_indices:
        row = df.iloc[idx]
        results.append(
            {
                "id": str(row.get("id", "")),
                "title": str(row.get("title", "")),
                "artist": str(row.get("artist", "")),
                "genre": str(row.get("genre", "")),
                "score": float(scores[idx]),
            }
        )

    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

import argparse
import json
from typing import Tuple

import joblib
import numpy as np

from utils import top_k_from_scores


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Predict genre with trained model")
    parser.add_argument("--model", default="models/model.joblib")
    parser.add_argument("--title", default="")
    parser.add_argument("--artist", default="")
    parser.add_argument("--memo", default="")
    parser.add_argument("--text", default="")
    parser.add_argument("--top-k", type=int, default=3)
    return parser.parse_args()


def build_input_text(args: argparse.Namespace) -> str:
    if args.text.strip():
        return args.text.strip()
    combined = f"{args.title} {args.artist} {args.memo}".strip()
    return combined


def scores_from_classifier(clf, vector) -> Tuple[np.ndarray, np.ndarray]:
    labels = clf.classes_
    if hasattr(clf, "predict_proba"):
        probs = clf.predict_proba(vector)[0]
        return labels, probs

    if hasattr(clf, "decision_function"):
        scores = clf.decision_function(vector)
        if scores.ndim == 1:
            if len(labels) == 2:
                scores = np.vstack([-scores, scores]).T
            else:
                scores = scores.reshape(1, -1)
        scores = scores[0]
        exp_scores = np.exp(scores - np.max(scores))
        probs = exp_scores / exp_scores.sum()
        return labels, probs

    preds = clf.predict(vector)
    probs = np.zeros(len(labels))
    probs[list(labels).index(preds[0])] = 1.0
    return labels, probs


def main() -> None:
    args = parse_args()
    text = build_input_text(args)
    if not text:
        raise SystemExit("Input text is empty.")

    pipeline = joblib.load(args.model)
    vector = pipeline.named_steps["tfidf"].transform([text])
    clf = pipeline.named_steps["clf"]

    labels, probs = scores_from_classifier(clf, vector)
    best_idx = int(np.argmax(probs))

    result = {
        "predicted_genre": str(labels[best_idx]),
        "confidence": float(probs[best_idx]),
        "top_k": top_k_from_scores([str(x) for x in labels], probs, args.top_k),
    }

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

import argparse
import json
from pathlib import Path

import joblib
import matplotlib.pyplot as plt
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import ConfusionMatrixDisplay, classification_report
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC

from utils import build_vectorizer, load_csv, split_train_test


def build_classifier(name: str):
    if name == "logreg":
        return LogisticRegression(max_iter=2000)
    if name == "nb":
        return MultinomialNB()
    return LinearSVC()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train repertoire AI model")
    parser.add_argument("--csv", required=True, help="Path to training CSV")
    parser.add_argument(
        "--algorithm",
        choices=["svm", "logreg", "nb"],
        default="svm",
        help="Classifier type",
    )
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--model-out", default="models/model.joblib")
    parser.add_argument("--report-out", default="outputs/metrics.json")
    parser.add_argument("--matrix-out", default="outputs/confusion_matrix.png")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    df = load_csv(args.csv)
    if df.empty:
        raise SystemExit("No valid rows found in CSV.")

    x_train, x_test, y_train, y_test = split_train_test(
        df["text"], df["genre"], args.test_size, args.seed
    )

    pipeline = Pipeline(
        [
            ("tfidf", build_vectorizer()),
            ("clf", build_classifier(args.algorithm)),
        ]
    )

    pipeline.fit(x_train, y_train)
    y_pred = pipeline.predict(x_test)

    report = classification_report(y_test, y_pred, output_dict=True)
    report_text = classification_report(y_test, y_pred)

    model_path = Path(args.model_out)
    report_path = Path(args.report_out)
    matrix_path = Path(args.matrix_out)

    model_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    matrix_path.parent.mkdir(parents=True, exist_ok=True)

    joblib.dump(pipeline, model_path)

    with report_path.open("w", encoding="utf-8") as fp:
        json.dump(report, fp, ensure_ascii=False, indent=2)

    labels = sorted(np.unique(y_test))
    disp = ConfusionMatrixDisplay.from_predictions(
        y_test,
        y_pred,
        labels=labels,
        xticks_rotation=45,
        cmap="Blues",
        values_format="d",
    )
    disp.figure_.tight_layout()
    disp.figure_.savefig(matrix_path)
    plt.close(disp.figure_)

    labels_path = report_path.parent / "labels.txt"
    labels_path.write_text("\n".join(labels), encoding="utf-8")

    print("=== Training complete ===")
    print(f"Rows: {len(df)}")
    print(f"Model: {model_path}")
    print(f"Metrics: {report_path}")
    print(f"Confusion matrix: {matrix_path}")
    print("\n--- Classification report ---\n")
    print(report_text)


if __name__ == "__main__":
    main()

"""Audit a prepared training directory or batch ZIP without changing its data.

Usage: python scripts/audit-training.py INPUT NEW_REPORT.json
Optional depth-3 baseline requires numpy and scikit-learn in this interpreter.
"""

import argparse
import csv
import io
import json
from pathlib import Path, PurePosixPath
from collections import Counter
from itertools import combinations
from math import isfinite
from statistics import median
from zipfile import ZipFile


PARTITIONS = ("train", "validation", "test")
FEATURES = ("r_no_grease", "rho_ja4", "m_cross", "s_mux", "h_ip", "h_uri",
            "h_query", "r_static", "r_ip", "iat", "l_markov", "t_up")


def load(source):
    archive = ZipFile(source) if source.is_file() else None
    try:
        prefix = ""
        if archive:
            matches = [name for name in archive.namelist()
                       if PurePosixPath(name).name == "train-X.csv"]
            if len(matches) != 1:
                raise ValueError("ZIP must contain exactly one prepared training directory")
            prefix = matches[0][:-len("train-X.csv")]

        def read(name):
            if archive:
                if archive.getinfo(prefix + name).file_size > 128 * 1024 * 1024:
                    raise ValueError("Audit input exceeds 128 MiB per file")
                return archive.read(prefix + name).decode("utf-8-sig")
            file = source / name
            if file.stat().st_size > 128 * 1024 * 1024:
                raise ValueError("Audit input exceeds 128 MiB per file")
            return file.read_text(encoding="utf-8-sig")

        data = {}
        for partition in PARTITIONS:
            records = list(csv.reader(io.StringIO(read(partition + "-X.csv"))))
            if not records or tuple(records[0]) != FEATURES:
                raise ValueError(partition + " X must contain exactly the 12 feature columns")
            x = [tuple(map(float, record)) for record in records[1:]]
            targets = list(csv.reader(io.StringIO(read(partition + "-y.csv"))))
            if not targets or targets[0] != ["target"]:
                raise ValueError(partition + " y must contain only target")
            y = [int(record[0]) for record in targets[1:]]
            groups = [json.loads(line) for line in read(partition + "-groups.jsonl").splitlines() if line]
            if not x or len(x) != len(y) or len(x) != len(groups):
                raise ValueError(partition + " X/y/groups must have equal nonzero row counts")
            if any(len(row) != 12 or not all(map(isfinite, row)) for row in x):
                raise ValueError(partition + " contains missing/nonfinite features")
            if any(label not in range(4) for label in y):
                raise ValueError(partition + " has an unknown target")
            if any(not row.get("split_group_id") or not row.get("session_id") for row in groups):
                raise ValueError(partition + " has missing group/session provenance")
            data[partition] = (x, y, groups)
        reference = json.loads(read("markov-reference.json"))
        return data, reference
    finally:
        if archive:
            archive.close()


def audit(data, reference):
    result = {"features": FEATURES, "splits": {}, "overlaps": {}, "class_feature_ranges": {}}
    warnings = []
    for partition, (x, y, groups) in data.items():
        result["splits"][partition] = {
            "rows": len(x), "groups": len({row["split_group_id"] for row in groups}),
            "labels": dict(Counter(y)), "duplicate_extra_rows": len(x) - len(set(x)),
        }
    for left, right in combinations(PARTITIONS, 2):
        x_left, _, g_left = data[left]
        x_right, _, g_right = data[right]
        overlap = {key: len({row[key] for row in g_left} & {row[key] for row in g_right})
                   for key in ("split_group_id", "session_id")}
        overlap["exact_feature_vectors"] = len(set(x_left) & set(x_right))
        result["overlaps"][left + "_" + right] = overlap
        if any(overlap.values()):
            warnings.append(left + "/" + right + " overlap requires inspection")
    all_rows = [(row, target) for x, y, _ in data.values() for row, target in zip(x, y)]
    for label in range(4):
        selected = [row for row, target in all_rows if target == label]
        result["class_feature_ranges"][label] = {
            feature: {"min": min(values), "median": median(values), "max": max(values),
                      "distinct": len(set(values))}
            for index, feature in enumerate(FEATURES)
            if (values := [row[index] for row in selected])
        }
    train_groups = {row["split_group_id"] for row in data["train"][2]}
    reference_groups = set(reference.get("train_group_ids", []))
    result["markov_group_provenance_valid"] = bool(reference_groups) and reference_groups <= train_groups
    if not result["markov_group_provenance_valid"]:
        warnings.append("Markov reference has absent or non-training group provenance")
    try:
        import numpy as np
        from sklearn.tree import DecisionTreeClassifier, export_text
        from sklearn.metrics import accuracy_score, f1_score
    except ImportError:
        result["baseline"] = {"available": False, "reason": "Install numpy and scikit-learn to run the diagnostic baseline"}
    else:
        x_train = np.array(data["train"][0])
        y_train = np.array(data["train"][1])

        def fit(columns, labels):
            model = DecisionTreeClassifier(max_depth=3, min_samples_leaf=5, random_state=42)
            model.fit(x_train[:, columns], labels)
            scores = {}
            for partition, (x, y, _) in data.items():
                prediction = model.predict(np.array(x)[:, columns])
                scores[partition] = {"accuracy": float(accuracy_score(y, prediction)),
                                     "macro_f1": float(f1_score(y, prediction, average="macro", labels=[0, 1, 2, 3], zero_division=0))}
            return {"scores": scores, "rules": export_text(model, feature_names=[FEATURES[i] for i in columns])}

        baseline = fit(list(range(12)), y_train)
        baseline["available"] = True
        baseline["single_features"] = {feature: fit([index], y_train) for index, feature in enumerate(FEATURES)}
        shuffled = fit(list(range(12)), np.random.default_rng(42).permutation(y_train))
        baseline["shuffled_training_labels"] = shuffled["scores"]
        result["baseline"] = baseline
        if all(baseline["scores"][part]["macro_f1"] >= .98 for part in ("validation", "test")):
            warnings.append("A depth-3 tree nearly perfectly separates both holdouts; inspect generator shortcuts and independent workloads")
    result["warnings"] = warnings
    result["scope"] = "Dataset diagnostics; the original training notebook and real-world generalization are not verified"
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    if args.output.exists():
        parser.error("Choose a new output file; existing reports are preserved")
    report = audit(*load(args.input))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("x", encoding="utf-8") as output:
        json.dump(report, output, indent=2, allow_nan=False)
    print(json.dumps({"report": str(args.output.resolve()), "splits": report["splits"], "warnings": report["warnings"]}))


if __name__ == "__main__":
    main()

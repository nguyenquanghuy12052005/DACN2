import csv
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from zipfile import ZipFile

spec = importlib.util.spec_from_file_location("audit_training", Path(__file__).resolve().parents[1] / "audit-training.py")
audit_training = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit_training)


class AuditTrainingTests(unittest.TestCase):
    def fixture(self, root):
        for part in audit_training.PARTITIONS:
            with (root / (part + "-X.csv")).open("w", newline="") as output:
                writer = csv.writer(output)
                writer.writerow(audit_training.FEATURES)
                writer.writerows([[label] * 12 for label in range(4) for _ in range(10)])
            (root / (part + "-y.csv")).write_text("target\n" + "".join(str(label) + "\n" for label in range(4) for _ in range(10)))
            (root / (part + "-groups.jsonl")).write_text("".join(json.dumps({"session_id": part, "split_group_id": part}) + "\n" for _ in range(40)))
        (root / "markov-reference.json").write_text(json.dumps({"train_group_ids": ["train"]}))

    def test_zip_and_directory_agree_and_holdout_labels_never_fit_rules(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            data, reference = audit_training.load(root)
            result = audit_training.audit(data, reference)
            self.assertEqual(result["overlaps"]["train_test"]["split_group_id"], 0)
            self.assertEqual(result["overlaps"]["train_test"]["exact_feature_vectors"], 4)
            self.assertTrue(result["markov_group_provenance_valid"])
            archive = root / "batch.zip"
            with ZipFile(archive, "w") as output:
                for source in root.glob("*.csv"):
                    output.write(source, "training/" + source.name)
                for source in root.glob("*.json*"):
                    output.write(source, "training/" + source.name)
            self.assertEqual(audit_training.load(archive), (data, reference))
            if result["baseline"]["available"]:
                self.assertEqual(result["baseline"]["scores"]["test"]["accuracy"], 1)
                x, y, groups = data["test"]
                data["test"] = (x, [(label + 1) % 4 for label in y], groups)
                changed = audit_training.audit(data, reference)
                self.assertEqual(result["baseline"]["rules"], changed["baseline"]["rules"])
                self.assertEqual(changed["baseline"]["scores"]["test"]["accuracy"], 0)

    def test_label_column_in_x_and_row_misalignment_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            file = root / "test-X.csv"
            file.write_text(file.read_text().replace("t_up", "target", 1))
            with self.assertRaisesRegex(ValueError, "12 feature columns"):
                audit_training.load(root)
            self.fixture(root)
            (root / "test-y.csv").write_text("target\n0\n")
            with self.assertRaisesRegex(ValueError, "equal nonzero row counts"):
                audit_training.load(root)


if __name__ == "__main__":
    unittest.main()

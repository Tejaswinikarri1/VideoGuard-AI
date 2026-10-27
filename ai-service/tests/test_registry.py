from app.detection.registry import resolve_classes


def test_supported_and_unsupported_reported_not_fabricated():
    names = {0: "person", 2: "car", 7: "truck", 24: "backpack"}
    r = resolve_classes(names)
    assert r.label_to_category == {"person": "person", "car": "vehicle", "truck": "vehicle", "backpack": "bag"}
    assert "knife" in r.unsupported_categories
    assert r.missing_labels["vehicle"] == ["motorcycle", "bus"]


def test_knife_supported_only_if_label_exists():
    assert "knife" not in resolve_classes({0: "person"}).supported
    assert resolve_classes({0: "person", 43: "knife"}).supported["knife"] == ["knife"]

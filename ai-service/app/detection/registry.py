"""Maps a checkpoint's ACTUAL class labels to application categories.
Nothing is assumed: categories whose labels are absent from the checkpoint are reported unsupported."""
from dataclasses import dataclass

# Configurable. Labels are matched against the loaded checkpoint's names, never invented.
DEFAULT_CATEGORY_LABELS: dict[str, list[str]] = {
    "person": ["person"],
    "vehicle": ["car", "motorcycle", "bus", "truck"],
    "bag": ["backpack", "handbag", "suitcase"],
    "knife": ["knife"],
}


@dataclass
class ClassResolution:
    label_to_category: dict[str, str]
    supported: dict[str, list[str]]
    unsupported_categories: list[str]
    missing_labels: dict[str, list[str]]


def resolve_classes(model_names: dict[int, str] | list[str],
                    mapping: dict[str, list[str]] | None = None) -> ClassResolution:
    names = list(model_names.values()) if isinstance(model_names, dict) else list(model_names)
    present = {n.lower() for n in names}
    mapping = mapping or DEFAULT_CATEGORY_LABELS
    l2c: dict[str, str] = {}
    supported: dict[str, list[str]] = {}
    missing: dict[str, list[str]] = {}
    unsupported: list[str] = []
    for cat, labels in mapping.items():
        found = [l for l in labels if l.lower() in present]
        gone = [l for l in labels if l.lower() not in present]
        if gone:
            missing[cat] = gone
        if found:
            supported[cat] = found
            l2c.update({l.lower(): cat for l in found})
        else:
            unsupported.append(cat)
    return ClassResolution(l2c, supported, unsupported, missing)

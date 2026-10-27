"""Download ONLY the detection part of OD-WeaponDetection (github.com/ari-dasci/OD-WeaponDetection) with a sparse git checkout.
Needs git. Roughly 1-2 GB for the Pistol + Knife detection folders (images included).

  python -m training.fetch_od_weapon --out C:\\data\\od-weapon

License of the dataset: CC BY-SA 4.0 (attribution + share-alike). Read License.md in the download and cite the authors
(Gonzalez et al., Granada) when you use or publish models trained on it. Share-alike may apply to adapted data; get legal advice before commercial use."""
import argparse
import subprocess
import sys
from pathlib import Path

REPO = "https://github.com/ari-dasci/OD-WeaponDetection"
FOLDERS = ["Pistol detection", "Knife_detection"]


def run(cmd, cwd=None):
    print("$", " ".join(cmd))
    subprocess.run(cmd, cwd=cwd, check=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--out", required=True, type=Path)
    a = ap.parse_args()
    try:
        subprocess.run(["git", "--version"], check=True, capture_output=True)
    except (OSError, subprocess.CalledProcessError):
        sys.exit("git is not installed. Install it (winget install Git.Git) or download the repository ZIP from GitHub manually.")
    a.out.mkdir(parents=True, exist_ok=True)
    if not (a.out / ".git").exists():
        run(["git", "clone", "--depth", "1", "--filter=blob:none", "--sparse", REPO, str(a.out)])
    run(["git", "sparse-checkout", "set", *FOLDERS], cwd=a.out)
    print("\nDone. Next:\n  python -m training.prepare_dataset "
          f'--pair "{a.out}/Pistol detection/Weapons::{a.out}/Pistol detection/xmls" '
          f'--pair "{a.out}/Knife_detection/Images::{a.out}/Knife_detection/annotations" --out datasets/od_weapon --format voc --negatives <folder of weapon-free frames>')

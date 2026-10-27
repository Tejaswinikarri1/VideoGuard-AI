"""Alias for setup_models.py: downloads the official pretrained yolov8n.pt into models/ and prints its sha256.
Run from the ai-service folder:  python scripts\\download_weights.py"""
import runpy
from pathlib import Path

runpy.run_path(str(Path(__file__).with_name("setup_models.py")), run_name="__main__")

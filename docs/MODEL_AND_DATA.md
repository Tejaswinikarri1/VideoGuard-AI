# Models, data and evaluation: what is true today

## 1. What was trained?
- **YOLOv8n (person, vehicle, bag, knife):** pretrained by Ultralytics on **COCO** (real, human-annotated). Not trained here.
- **Pose model (fall detection):** pretrained YOLOv8n-pose (COCO keypoints). Not trained here.
- **Weapon checkpoint:** **none trained yet.** A 54-second *pilot* fine-tune on 80 real OD-WeaponDetection images proved the pipeline works, and its model is useless (it labelled a knife as a pistol). Its metrics came from 12 test images: ignore them.
- **Loitering / running / intrusion / fall / severity:** deterministic rules, not learned. They need *calibration*, not training.
No synthetic data was used for any model. Synthetic video (test patterns, panned photos) appears only in plumbing tests.

## 2. Real-video test (what it does and does not show)
`vtest.avi` (OpenCV's public pedestrian sample, 79.5 s) through the real pipeline: tracks follow real pedestrians, evidence images show correct boxes, 4 loitering candidates.
Measured: one person moved 0.37 body-heights in 12 s (clearly standing); three sat at 0.71-0.75 body-heights over ~8 s against a 0.75 threshold (borderline slow movers).
Also 72 tracks for ~15 people: **tracks fragment** (crowds, occlusion, 5 fps sampling), which can break loitering/fall rules. There is no ground truth, so precision and recall are unknown.
Finding that changed the code: a frame-fraction threshold treats distant walkers as stationary, so both motion rules now use body-heights.

## 3. OD-WeaponDetection (github.com/ari-dasci/OD-WeaponDetection)
Inspected from the real repository (not assumed):
- `Pistol detection/` = `Weapons/` (3,000 images, .jpg) + `xmls/` (3,000 VOC files); `Knife_detection/` = `Images/` (2,078, .JPG) + `annotations/` (2,078 VOC files).
- Classes: `pistol` (3,464 boxes) and `knife` (2,155 boxes). Every annotation matches an image by file-name stem (case-insensitive); XML `<filename>` and `<path>` tags are unreliable and ignored.
- ~616 pistol images are tiny (160x120); the data are mostly web photos and staged knife footage, **not CCTV**. There are **no weapon-free images**, so a model trained only on it will fire on ordinary objects. Add negatives from your own cameras (`training/extract_frames.py`).
- License stated by the authors: **CC BY-SA 4.0** (attribution + share-alike). Read `License.md`, cite the authors, and take legal advice before commercial use.

## 4. How to train it properly
Open `ai-service/training/kaggle_weapon_train.ipynb` on Kaggle (free GPU, internet on). It downloads the dataset, converts it, trains YOLOv8n and reports held-out metrics. Then copy `best.pt` to `ai-service/models/weapon/`, set `WEAPON_MODEL_ENABLED=true`, `WEAPON_LABELS=pistol,knife`.
Or locally: `python -m training.fetch_od_weapon --out C:\data\od-weapon`, then `training.prepare_dataset` with the two `--pair` arguments, then `training.train_weapon`.
Why not here: the build sandbox has 1 CPU core and no GPU. Measured: 90 images x 3 epochs at 320 px took 54 s, which extrapolates to roughly 13 minutes per epoch for all 5,078 images at 320 px (and several times more at 640 px). A GPU is the sensible route.
After training, **test on your own weapon-free and weapon footage** with `scripts/analyze_video.py`: the dataset's test split says nothing about your cameras. If you send me `best.pt` (about 6 MB) and the `training_report.json`, I can wire it in and test it on real clips.

## 5. Which events exist and how reliable are they?
| Event | Method | Needs | Main failure modes |
|---|---|---|---|
| Person Loitering | stays within X body-heights for Y s | person track | fragmented tracks; people standing legitimately; threshold at the boundary |
| Sudden Running | sustained body-heights/s | person track | tracking jumps; sampling rate; camera shake |
| Restricted Area Intrusion | foot point inside a zone you drew | zone | foot occluded; zone drawn on the wrong frame |
| Fall Detected | upright -> lying within 2 s, stays down 2.5 s (pose) | `POSE_MODEL_ENABLED=true` | overhead cameras, occlusion, people lying down on purpose |
| Weapon Detection | label seen in >= 3 distinct sampled frames | COCO knife and/or your checkpoint | small/occluded objects; kitchen items; the untrained gun class |
| Fights, theft | **not implemented** | a video action model trained on labelled video | |
Every event starts PENDING and needs a human decision.

## 6. If you upload a real video
It will be decoded, analysed with the models above and produce candidate events with evidence. It will **not** be correct "exactly": expect false positives and misses until you calibrate thresholds on labelled footage of your cameras. YouTube footage must be downloaded by you (this sandbox cannot reach YouTube); only use video you have the right to use.

## 7. Licensing
Ultralytics YOLOv8 code and weights: AGPL-3.0. OD-WeaponDetection: CC BY-SA 4.0. OpenCV sample video: part of the OpenCV project (Apache-2.0).

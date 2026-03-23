"""
Downloads all audio files from kheng.info:
  - Consonants        -> audio/c-01.mp3 ... c-33.mp3
  - Digraphs          -> audio/d-01.mp3 ... d-10.mp3
  - A-Series Vowels   -> audio/v-01.mp3  ... v-23.mp3
  - B-Series Vowels   -> audio/vb-01.mp3 ... vb-23.mp3
  - Independent Vowels-> audio/vi-01.mp3 ... vi-14.mp3

Usage:
    python3 download_vowel_audio.py
"""

import urllib.request
import os
import time

BASE_URL = "https://kheng.info/static/dictionary/audio/"
OUTPUT_DIR = "audio"
os.makedirs(OUTPUT_DIR, exist_ok=True)

GROUPS = [
    ("Consonants", "c", [
        "ក","ខ","គ","ឃ","ង","ច","ឆ","ជ","ឈ","ញ",
        "ដ","ឋ","ឌ","ឍ","ណ","ត","ថ","ទ","ធ","ន",
        "ប","ផ","ព","ភ","ម","យ","រ","ល","វ","ស",
        "ហ","ឡ","អ",
    ]),
    ("Digraphs", "d", [
        "ហ្គ","ហ្គ៊","ហ្ន","ប៉","ហ្ម","ហ្ល","ហ្វ","ហ្វ៊","ហ្ស","ហ្ស៊",
    ]),
    ("A-Series Vowels (ka reference)", "v", [
        "កា","កិ","កី","កឹ","កឺ","កុ","កូ","កួ","កើ","កឿ",
        "កៀ","កេ","កែ","កៃ","កោ","កៅ","កុំ","កំ","កាំ","កះ",
        "កិះ","កេះ","កោះ",
    ]),
    ("B-Series Vowels (ko reference)", "vb", [
        "គា","គិ","គី","គឹ","គឺ","គុ","គូ","គួ","គើ","គឿ",
        "គៀ","គេ","គែ","គៃ","គោ","គៅ","គុំ","គំ","គាំ","គះ",
        "គិះ","គេះ","គោះ",
    ]),
    ("Independent Vowels", "vi", [
        "ឥ","ឦ","ឧ","ឩ","ឪ","ឫ","ឬ","ឭ","ឮ","ឯ","ឰ","ឱ","ឲ","ឳ",
    ]),
]

total_success = 0
total_failed = []

for group_name, prefix, words in GROUPS:
    print(f"\n-- {group_name} ({len(words)} files) --")
    for i, word in enumerate(words):
        num = str(i + 1).zfill(2)
        filename = f"{prefix}-{num}.mp3"
        filepath = os.path.join(OUTPUT_DIR, filename)
        url = BASE_URL + urllib.request.quote(word, safe='') + ".mp3"
        try:
            urllib.request.urlretrieve(url, filepath)
            size = os.path.getsize(filepath)
            print(f"  OK  {filename}  {word}  ({size/1024:.1f} KB)")
            total_success += 1
        except Exception as e:
            print(f"  FAIL {filename}  {word}  {e}")
            total_failed.append((filename, word, url))
        time.sleep(0.15)

total = sum(len(g[2]) for g in GROUPS)
print(f"\nDone. {total_success}/{total} files downloaded.")
if total_failed:
    print(f"\nFailed ({len(total_failed)}):")
    for fn, word, url in total_failed:
        print(f"  {fn}  {word}  {url}")

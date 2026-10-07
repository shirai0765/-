#!/usr/bin/env python3
"""Check delivered audio headers, hashes, measured boundaries and player references.

Optional --track cafe-lounge supports the first of the two asset PRs.
Does not claim human listening or browser playback verification.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import wave

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "public/audio/external-v080/bgm"
DOC = ROOT / "docs/external/audio-bgm"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--track", choices=["cafe-lounge", "shibuya-citypop"])
    args = parser.parse_args()
    manifests = [OUT / f"{args.track}.manifest.json"] if args.track else sorted(OUT.glob("*.manifest.json"))
    assert manifests, "No track manifests"
    report = {"task": "A01", "checks": [], "humanListening": "not-performed",
              "browserPlayback": "not-performed", "scope": "Header/hash and measured-signal assertions; static HTML/JS only"}
    for manifest in manifests:
        track = json.loads(manifest.read_text())
        frames = track["loopEndFrame"]
        assert track["loopStartFrame"] == 0
        assert 30 <= frames / 44100 <= 60
        assert track["sampleRate"] == 44100 and track["channels"] == 2
        with wave.open(str(ROOT / track["wav"]["path"]), "rb") as wav:
            assert (wav.getframerate(), wav.getnchannels(), wav.getsampwidth(), wav.getnframes()) == (44100, 2, 2, frames)
        for format in ("wav", "ogg", "mp3"):
            asset = track[format]
            file = ROOT / asset["path"]
            assert file.stat().st_size == asset["bytes"]
            assert hashlib.sha256(file.read_bytes()).hexdigest() == asset["sha256"]
            measured = asset if format == "wav" else asset["decodedSignal"]
            assert measured["sampleFrames"] == frames
            assert measured["clippedSamples"] == 0
            assert asset["truePeakDbtp"] < -4
            seam = measured["loopBoundary"]
            assert seam["lastToFirstMaximumDeltaDbfs"] < (-60 if format == "wav" else -50)
            assert seam["lastToFirstMaximumDeltaDbfs"] < seam["neighboring100msMaximumStepDbfs"] - 12
        html = (OUT / f"{track['id']}-preview.html").read_text()
        for file in re.findall(r'(?:src|href)="([^"]+)"', html):
            if not file.startswith(("http", "#")):
                assert (OUT / file).is_file(), file
        report["checks"].append({"id": track["id"], "wavOggMp3": "PASS",
                                 "perTrackPreviewAssetReferences": "PASS"})
    result = subprocess.run(["node", "--check", str(OUT / "preview-player.js")],
                            capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    report["playerJavascriptSyntax"] = "PASS"
    path = DOC / (f"validation-{args.track}.json" if args.track else "validation.json")
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()

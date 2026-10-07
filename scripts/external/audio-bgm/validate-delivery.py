#!/usr/bin/env python3
"""Bind delivery measurement metadata to real files; no claim of human audition.

Run under the author's assigned worker after supplement.py. Measurements are
produced by actual float decode in supplement.py; hashes bind that evidence here.
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


def verify_file(asset):
    path = ROOT / asset["path"]
    assert path.stat().st_size == asset["bytes"], path
    assert hashlib.sha256(path.read_bytes()).hexdigest() == asset["sha256"], path
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--track", choices=["cafe-lounge", "shibuya-citypop"])
    args = parser.parse_args()
    names = [args.track] if args.track else ["cafe-lounge", "shibuya-citypop"]
    report = {"humanListening": "not-performed", "browserPlayback": "not-performed", "tracks": []}
    for name in names:
        track = json.loads((OUT / f"{name}.manifest.json").read_text())
        master = track["master"]
        master_path = verify_file(master)
        with wave.open(str(master_path), "rb") as wav:
            assert (wav.getframerate(), wav.getnchannels(), wav.getsampwidth(), wav.getnframes()) == (44100, 2, 3, track["loopEndFrame"])
        assert master["existing16bitWavReproductionSha256Matched"]
        assert master["nonzeroLowByteSamples"] > 0
        assert -22 <= master["integratedLufs"] <= -18 and master["truePeakDbtp"] <= -1
        warnings = []
        for format in ("m4a", "ogg", "mp3", "wav"):
            asset = track[format]
            verify_file(asset)
            qa = asset["deliveryVerification"]
            assert qa["decodedFrames"] - qa["trailingFramesTrimmed"] == track["loopEndFrame"]
            assert qa["loopStart"] == 0 and qa["loopEnd"] == track["loopEndFrame"] / 44100
            assert qa["trimmedLoopSignal"]["clippedSamples"] == 0
            assert qa["decodedLoopLoudness"]["truePeakDbtp"] <= -1
            cycles = qa["threeCycleCheck"]
            assert cycles["cycles"] == 3 and len(cycles["joins"]) == 2
            assert cycles["clippedSamples"] == 0 and cycles["cycleRmsRangeDb"] < .001
            for join in cycles["joins"]:
                assert join["silent20msWindowsBelowMinus80Dbfs"] == 0
                # Quantitative discontinuity gate, still not a human click judgment.
                assert join["maximumAdjacentStepDbfs"] < -45, (name, format, join)
            if format != "wav":
                assert asset["bytes"] <= 1_500_000
            if not -22 <= qa["decodedLoopLoudness"]["integratedLufs"] <= -18:
                if name == "cafe-lounge" and format == "mp3":
                    warnings.append("Preserved cafe MP3 slightly below -22 LUFS; use preferred AAC/OGG after output QA")
                else:
                    raise AssertionError((name, format, "LUFS outside contract", qa["decodedLoopLoudness"]))
        aac = track["m4a"]["ffprobe"]["streams"][0]
        assert aac["codec_name"] == "aac" and aac["profile"] == "LC"
        assert int(aac["sample_rate"]) == 44100 and aac["channels"] == 2
        short = track["shortAudition"]
        verify_file(short)
        assert 20 <= short["programDurationSeconds"] <= 30 and short["loop"] is False
        assert short["decodedSignal"]["clippedSamples"] == 0
        assert [Path(v["path"]).suffix for v in track["cityAudioAsset"]["variants"]] == [".m4a", ".ogg", ".mp3"]
        for variant in track["cityAudioAsset"]["variants"]:
            assert re.fullmatch(r"audio/external-v080/bgm/[A-Za-z0-9_-]+\.(?:m4a|ogg|mp3)", variant["path"])
            assert (ROOT / "public" / variant["path"]).is_file()
            assert variant["loopStart"] == 0 and variant["loopEnd"] == track["durationSeconds"]
        html = (OUT / f"{name}-preview.html").read_text()
        for reference in re.findall(r'(?:src|href)="([^"]+)"', html):
            if not reference.startswith(("http", "#")):
                assert (OUT / reference).is_file(), reference
        report["tracks"].append({"id": name, "master24bitHashAndHeader": "PASS",
                                 "decodedDeliveryThreeCycles": "PASS", "AACAndShortAudition": "PASS",
                                 "realVariantsAndHtmlReferences": "PASS", "warnings": warnings})
    result = subprocess.run(["node", "--check", str(OUT / "preview-player.js")], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    report["javascriptSyntax"] = "PASS"
    filename = f"delivery-validation-{args.track}.json" if args.track else "delivery-validation.json"
    (DOC / filename).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()

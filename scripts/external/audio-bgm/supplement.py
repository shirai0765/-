#!/usr/bin/env python3
"""Add float-derived 24-bit masters, AAC-LC, 24-second auditions and delivery QA.

Requires an assigned single CPU worker. Existing WAV/OGG/MP3 files are never replaced.
Run after render.py with OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1.
No third-party music, samples, network calls or new dependencies.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import wave

import numpy as np
from render import ROOT, OUT, DOC, SR, compose, db, loudness, signal_metrics, write_wav

CONTRACT = "https://github.com/shirai0765/-/pull/8#issuecomment-6032142623"
TYPE_SOURCE = "https://github.com/shirai0765/-/blob/b40f2ba/src/audio/CityAudioAssets.ts"


def run(arguments, **kwargs):
    return subprocess.run(arguments, check=True, **kwargs)


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def file_info(path):
    return {"path": str(path.relative_to(ROOT)), "bytes": path.stat().st_size,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}


def write_master(path, source_float):
    # Quantize the original float64 mix directly, never upconvert the 16-bit delivery.
    integers = np.rint(np.clip(source_float, -1, 1) * 8388607).astype("<i4")
    packed = integers.reshape(-1).view(np.uint8).reshape(-1, 4)[:, :3].copy()
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(3)
        wav.setframerate(SR)
        wav.writeframes(packed.tobytes())
    return {"pcmBitDepth": 24, "sampleRate": SR, "channels": 2,
            "generation": "Direct quantization of deterministic compose(id) float64 mix; not 16-bit expansion",
            "nonzeroLowByteSamples": int(np.count_nonzero(packed[:, 0]))}


def encode_aac(source, destination):
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-nostdin",
         "-threads", "1", "-i", str(source), "-c:a", "aac", "-profile:a", "aac_low",
         "-b:a", "160k", "-ar", str(SR), "-ac", "2", "-threads", "1",
         "-movflags", "+faststart", "-movie_timescale", str(SR), str(destination)])


def probe(path):
    result = run(["ffprobe", "-v", "error", "-select_streams", "a:0",
                  "-show_entries", "stream=codec_name,profile,sample_rate,channels,bit_rate,duration,start_time:format=duration,size",
                  "-of", "json", str(path)], capture_output=True, text=True)
    return json.loads(result.stdout)


def decode_float(path, destination):
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-nostdin",
         "-threads", "1", "-i", str(path), "-c:a", "pcm_f32le", "-ar", str(SR),
         "-ac", "2", "-threads", "1", "-f", "f32le", str(destination)])
    return np.fromfile(destination, dtype="<f4").reshape(-1, 2).astype(np.float64)


def three_cycle_check(period):
    # Actually assemble three decoded, explicitly trimmed periods, with two joins.
    triple = np.tile(period, (3, 1))
    n = len(period)
    window = round(.02 * SR)
    joined = []
    for position in (n, 2 * n):
        local = triple[position - round(.1 * SR):position + round(.1 * SR)]
        blocks = [local[i:i + window] for i in range(0, len(local) - window + 1, window)]
        rms = [db(np.sqrt(np.mean(block ** 2))) for block in blocks]
        step = db(np.max(np.abs(triple[position] - triple[position - 1])))
        joined.append({"atFrame": position, "atSeconds": position / SR,
                       "maximumAdjacentStepDbfs": step,
                       "minimum20msRmsWithin100msDbfs": min(rms),
                       "silent20msWindowsBelowMinus80Dbfs": sum(level < -80 for level in rms),
                       "last50msRmsDbfs": db(np.sqrt(np.mean(triple[position-round(.05*SR):position] ** 2))),
                       "first50msRmsDbfs": db(np.sqrt(np.mean(triple[position:position+round(.05*SR)] ** 2)))})
    cycle_rms = [db(np.sqrt(np.mean(triple[i*n:(i+1)*n] ** 2))) for i in range(3)]
    return {"cycles": 3, "sampleFrames": len(triple), "durationSeconds": len(triple) / SR,
            "joins": joined, "cycleRmsDbfs": cycle_rms,
            "cycleRmsRangeDb": max(cycle_rms) - min(cycle_rms),
            "clippedSamples": int(np.count_nonzero(np.abs(triple) >= 1)),
            "method": "Concatenate three decoded periods after explicit frame trim; inspect both joins in 20ms RMS windows and adjacent-sample deltas. Repeated-period RMS equality is a numerical consequence, not human listening evidence.",
            "humanListening": "not-performed"}


def verify_distribution(path, frames, temporary):
    decoded = decode_float(path, temporary / "decoded.f32")
    if len(decoded) < frames:
        raise ValueError(f"{path.name}: decoded period too short: {len(decoded)} < {frames}")
    # ffmpeg honors encoder delay/edit lists; verify decoding and remaining end padding.
    period = decoded[:frames]
    trimmed = temporary / "decoded-loop-24bit.wav"
    write_master(trimmed, period)
    full_metrics = signal_metrics(decoded)
    full_metrics.pop("loopBoundary")  # Padding-bearing raw decode is not a loop.
    return {"decoder": "ffmpeg pcm_f32le, 44100Hz stereo; container delay/edit-list handling enabled",
            "decodedFrames": len(decoded), "decodedDurationSeconds": len(decoded) / SR,
            "leadingFramesTrimmed": 0, "trailingFramesTrimmed": len(decoded) - frames,
            "loopStartFrame": 0, "loopEndFrame": frames,
            "loopStart": 0, "loopEnd": frames / SR,
            "loopBoundaryBasis": "Original period length confirmed against this decoded stream; decoded end padding is excluded explicitly",
            "decodedSignal": full_metrics, "trimmedLoopSignal": signal_metrics(period),
            "decodedLoopLoudness": loudness(trimmed),
            "threeCycleCheck": three_cycle_check(period),
            "browserDecoderAndSafari": "not-performed; cross-decoder padding behavior requires internal output QA"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--track", choices=["cafe-lounge", "shibuya-citypop"])
    args = parser.parse_args()
    slugs = [args.track] if args.track else ["cafe-lounge", "shibuya-citypop"]
    masters = DOC / "masters"
    masters.mkdir(exist_ok=True)
    for slug in slugs:
        print(f"supplementing {slug}", flush=True)
        track = json.loads((OUT / f"{slug}.manifest.json").read_text())
        loop, samples = compose(slug)
        with tempfile.TemporaryDirectory(prefix="a01-delivery-") as name:
            temporary = Path(name)
            # Byte equality proves the score/gain did not silently change since delivery.
            comparison = temporary / "same-score.wav"
            write_wav(comparison, samples)
            assert hashlib.sha256(comparison.read_bytes()).hexdigest() == track["wav"]["sha256"]
            master = masters / f"{slug}-master-24bit.wav"
            provenance = write_master(master, samples)
            track["master"] = {**file_info(master), **provenance, **loudness(master),
                               "sampleFrames": loop.frames, "durationSeconds": loop.seconds,
                               "sourceFloatMetrics": signal_metrics(samples),
                               "existing16bitWavReproductionSha256Matched": True}
            aac = OUT / f"{slug}.m4a"
            encode_aac(master, aac)
            track["m4a"] = {**file_info(aac), "codec": "AAC-LC", "bitrateKbps": 160,
                            **loudness(aac), "ffprobe": probe(aac)}
            # A non-looping audition spans several phrases and has gentle edge fades.
            short_samples = samples[:24 * SR].copy()
            fade = round(.12 * SR)
            short_samples[:fade] *= np.linspace(0, 1, fade)[:, None]
            short_samples[-fade:] *= np.linspace(1, 0, fade)[:, None]
            short_master = temporary / "audition-24bit.wav"
            write_master(short_master, short_samples)
            short_aac = OUT / f"{slug}-audition-24s.m4a"
            encode_aac(short_master, short_aac)
            track["shortAudition"] = {**file_info(short_aac), "codec": "AAC-LC", "bitrateKbps": 160,
                                      "programDurationSeconds": 24, "loop": False,
                                      "edit": "First 24 seconds of original float mix; 120ms onset/end fades; audition only",
                                      **loudness(short_aac), "ffprobe": probe(short_aac)}
            short_decoded = decode_float(short_aac, temporary / "short.f32")
            track["shortAudition"]["decodedSignal"] = signal_metrics(short_decoded)
            track["shortAudition"]["decodedSignal"].pop("loopBoundary")
            for format in ("m4a", "ogg", "mp3", "wav"):
                asset = track[format]
                asset["deliveryVerification"] = verify_distribution(ROOT / asset["path"], loop.frames, temporary)
                asset["loopStart"] = asset["deliveryVerification"]["loopStart"]
                asset["loopEnd"] = asset["deliveryVerification"]["loopEnd"]
                asset["sampleRate"] = SR
                asset["channels"] = 2
                asset["conformsToRequestedLoudness"] = -22 <= asset["integratedLufs"] <= -18
                asset["conformsToRequestedTruePeak"] = asset["truePeakDbtp"] <= -1
                asset["compatibilityNote"] = "Preserved pre-contract encoding" if format in ("mp3", "ogg", "wav") else "New preferred AAC-LC delivery"
        track["cityAudioAsset"] = {"variants": [
            {"path": track[format]["path"].removeprefix("public/"),
             "loopStart": track[format]["loopStart"], "loopEnd": track[format]["loopEnd"]}
            for format in ("m4a", "ogg", "mp3")], "gain": 1}
        track["deliveryContract"] = {"url": CONTRACT, "typeSource": TYPE_SOURCE,
                                     "implementationSourceCommit": "b40f2ba",
                                     "runtimeActivation": "internal-team-only"}
        track["reproduction"] = {"score": "scripts/external/audio-bgm/render.py",
                                 "deliveryScript": "scripts/external/audio-bgm/supplement.py",
                                 "scoreSha256": hashlib.sha256((ROOT / "scripts/external/audio-bgm/render.py").read_bytes()).hexdigest(),
                                 "deliveryScriptSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                                 "numpyVersion": np.__version__, "sampleRate": SR,
                                 "sourcePrecision": "float64", "masterPcmBitDepth": 24,
                                 "seed": 8407 if slug == "cafe-lounge" else 11207,
                                 "workerLimit": 1, "ffmpegThreads": 1}
        track["verification"]["measured"] = "Per-distribution ffmpeg float decode, explicit seconds/frame trim, three-cycle adjacent-step and silence-window analysis; 24-bit master and short AAC audition metadata"
        write_json(OUT / f"{slug}.manifest.json", track)
        # Each song's PR exports a directly usable CityAudioAsset without partner paths.
        write_json(DOC / f"city-audio-assets-{slug}.json", track["cityAudioAsset"])
        html_file = OUT / f"{slug}-preview.html"
        html = html_file.read_text()
        if '<option value="m4a">' not in html:
            html = html.replace('<option value="ogg">', '<option value="m4a">AAC-LC</option><option value="ogg">', 1)
        if f'href="{slug}.m4a"' not in html:
            html = html.replace('<div class="downloads">', f'<div class="downloads"><a href="{slug}.m4a" download>AACを保存</a>', 1)
        if f'src="{slug}-audition-24s.m4a"' not in html:
            html = html.replace('</article>', f'<p class="small">24秒の短い試聴案（単発／前後120msフェード）</p><audio controls preload="metadata" src="{slug}-audition-24s.m4a"></audio><p class="small">AACの末尾paddingは、測定した秒のloopEndで繰返しから除きます。人間の聴感・Safari出力は未確認です。</p>\n</article>')
        html_file.write_text(html)
        print(f"{slug}: master, AAC and audition generated; decoded delivery loops measured", flush=True)
    # Existing track manifests are canonical; individual --track runs can be reviewed.
    all_tracks = [json.loads(p.read_text()) for p in sorted(OUT.glob("*.manifest.json"))]
    manifest = json.loads((DOC / "measurements.json").read_text())
    manifest["tracks"] = all_tracks
    manifest["deliveryContract"] = CONTRACT
    manifest["deliverySupplementStatus"] = "complete" if all("m4a" in t for t in all_tracks) else "partial"
    write_json(DOC / "measurements.json", manifest)
    eligible = [t for t in all_tracks if "cityAudioAsset" in t]
    write_json(DOC / "city-audio-assets.json", {"typeSource": TYPE_SOURCE,
        "contract": CONTRACT, "status": manifest["deliverySupplementStatus"],
        "distributionScope": "Optional aggregate reference after both song supplements arrive; single-song PRs use city-audio-assets-<track>.json",
        "requiredForSingleTrackReview": False,
        "musicCandidates": {t["id"]: t["cityAudioAsset"] for t in eligible},
        "runtimeActivation": "not-activated; select exactly one music candidate internally",
        "humanListening": "not-performed", "browserPlayback": "not-performed"})
    write_json(OUT / "loop-metadata.json", {"sampleRate": SR,
        "tracks": [{"id": t["id"], "frames": t["loopEndFrame"],
                    "durationSeconds": t["durationSeconds"],
                    "variants": t.get("cityAudioAsset", {}).get("variants", [])} for t in all_tracks]})
    total = sum(t[f]["bytes"] for t in all_tracks for f in ("ogg", "mp3", "m4a", "shortAudition") if f in t)
    runtime_compressed = sum(t[f]["bytes"] for t in all_tracks for f in ("ogg", "mp3", "m4a") if f in t)
    audio_root = ROOT / "public/audio/external-v080"
    public_audio = sorted(p for p in audio_root.rglob("*") if p.suffix.lower() in (".wav", ".m4a", ".mp3", ".ogg"))
    public_inventory = [file_info(p) for p in public_audio]
    write_json(DOC / "delivery-budget.json", {"compressedBgmTotalBytes": total,
        "compressedBgmBelow8DecimalMb": total <= 8_000_000,
        "runtimeCompressedBgmVariantsBytes": runtime_compressed,
        "runtimeCompressedScope": "All candidate full-track AAC/OGG/MP3 variants of both songs; runtime chooses one song. Short auditions and WAV are excluded from this compressed total.",
        "allPublicAudioFilesBytesAtMeasurement": sum(item["bytes"] for item in public_inventory),
        "allPublicAudioFileCountAtMeasurement": len(public_inventory),
        "publicAudioInventoryAtMeasurement": public_inventory,
        "scope": "compressedBgmTotalBytes includes both full BGM AAC/OGG/MP3 and short AAC auditions. allPublicAudioFilesBytesAtMeasurement separately includes public BGM/SFX WAV and boundary inspections; docs masters, HTML/JS/JSON/SVG excluded. It is not a claim that all public audio is below 8MB.",
        "humanListening": "not-performed"})


if __name__ == "__main__":
    main()

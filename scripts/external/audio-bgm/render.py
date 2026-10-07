#!/usr/bin/env python3
"""Render two original cyclic compositions, encode, and measure. No downloaded samples.

Uses preinstalled NumPy for array math and ffmpeg for MP3 / EBU R128 only.
Run with OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python scripts/external/audio-bgm/render.py
All note positions, oscillators, noise percussion and effect tails are deterministic.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess
import tempfile
import wave

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "public/audio/external-v080/bgm"
DOC = ROOT / "docs/external/audio-bgm"
SR = 44100
TAU = 2 * math.pi


def db(x):
    return 20 * math.log10(max(float(x), 1e-12))


class Loop:
    def __init__(self, bpm, seed):
        self.bpm = bpm
        self.beat = 60 / bpm
        self.frames = round(64 * self.beat * SR)
        self.seconds = self.frames / SR
        # Exact period is defined by the rounded frame count, not a floating BPM clock.
        self.beat = self.seconds / 64
        self.mix = np.zeros((self.frames, 2), dtype=np.float64)
        self.rng = np.random.default_rng(seed)
        self.events = []

    def add(self, signal, beat, level, pan, instrument):
        start = round(beat * self.beat * SR)
        n = len(signal)
        gains = np.array([math.cos((pan + 1) * math.pi / 4),
                          math.sin((pan + 1) * math.pi / 4)]) * level
        stereo = signal[:, None] * gains
        # Wrap every note/release/percussion tail across the loop, without truncation.
        # Signals are shorter than one loop; add the contiguous spans directly.
        pos = start % self.frames
        first = min(n, self.frames - pos)
        self.mix[pos:pos + first] += stereo[:first]
        if first < n:
            self.mix[:n - first] += stereo[first:]
        self.events.append({"beat": round(beat, 4), "instrument": instrument})

    def tone(self, note, beats, kind):
        duration = beats * self.beat
        tail = {"keys": .55, "bass": .14, "lead": .35, "pad": .6,
                "guitar": .28, "bell": .7}[kind]
        t = np.arange(round((duration + tail) * SR)) / SR
        f = 440 * 2 ** ((note - 69) / 12)
        attack = {"keys": .012, "bass": .009, "lead": .025,
                  "pad": .18, "guitar": .007, "bell": .009}[kind]
        onset = 1 - np.exp(-t / attack)
        release = np.exp(-np.maximum(t - duration, 0) / (tail / 6))
        # Smooth final 15 ms makes finite event tails continuous at their endpoint.
        end = np.minimum(1., np.maximum((duration + tail - t) / .015, 0.))
        phase = TAU * f * t
        if kind == "keys":
            # Soft struck electric keys: fundamental plus decaying tine overtones.
            s = (np.sin(phase) * np.exp(-t / 1.6)
                 + .24 * np.sin(2 * phase) * np.exp(-t / .65)
                 + .07 * np.sin(3 * phase) * np.exp(-t / .22))
        elif kind == "bass":
            s = (np.sin(phase) + .19 * np.sin(2 * phase)
                 + .04 * np.sin(3 * phase)) * np.exp(-t / .8)
        elif kind == "lead":
            vibrato = .018 * np.sin(TAU * 4.7 * t) * (1 - np.exp(-t / .16))
            s = (np.sin(phase + vibrato) + .22 * np.sin(2 * phase + vibrato)
                 + .07 * np.sin(3 * phase)) * np.exp(-t / 2.)
        elif kind == "pad":
            s = (.55 * np.sin(phase) + .25 * np.sin(phase * 1.0025)
                 + .12 * np.sin(2 * phase))
        elif kind == "guitar":
            s = sum(np.sin(k * phase) / (k * k) for k in range(1, 7))
            s *= np.exp(-t / .16)
        else:
            s = (np.sin(phase) + .25 * np.sin(phase * 2.002)
                 + .07 * np.sin(phase * 4.01)) * np.exp(-t / .7)
        return s * onset * release * end

    def note(self, beat, pitch, length, kind, gain, pan=0):
        self.add(self.tone(pitch, length, kind), beat, gain, pan, kind)

    def drum(self, beat, kind, gain, pan=0):
        duration = {"kick": .32, "snare": .23, "hat": .065,
                    "open-hat": .24, "brush": .18, "rim": .08}[kind]
        t = np.arange(round(duration * SR)) / SR
        noise = self.rng.standard_normal(len(t))
        high = np.concatenate(([0.], np.diff(noise))) * .5
        if kind == "kick":
            # Integrate exponential pitch sweep rather than phase=f(t)*t.
            phase = TAU * (48 * t + 80 * .028 * (1 - np.exp(-t / .028)))
            s = np.sin(phase) * np.exp(-t / .074)
            s += .065 * high * np.exp(-t / .007)
        elif kind == "snare":
            s = (.38 * np.sin(TAU * 175 * t) * np.exp(-t / .035)
                 + .3 * high * np.exp(-t / .049))
        elif kind == "brush":
            s = .24 * high * np.exp(-t / .042)
        elif kind == "rim":
            s = (.45 * np.sin(TAU * 840 * t) + .2 * np.sin(TAU * 1530 * t))
            s *= np.exp(-t / .009)
        else:
            s = .26 * high * np.exp(-t / (.047 if kind == "open-hat" else .016))
        # Never start a hit with a discontinuous nonzero first sample.
        s *= np.minimum(t / .0018, 1.) * np.minimum((duration - t) / .008, 1.)
        self.add(s, beat, gain, pan, kind)

    def finish(self, target_rms_db):
        dry = self.mix.copy()
        # Circular early reflections / room tail. Stereo cross-feed is deliberately subtle.
        for seconds, gain in [(.043, .075), (.091, .065), (.157, .05),
                              (.239, .035), (.367, .024), (.557, .016),
                              (.811, .010), (1.109, .006)]:
            self.mix += gain * np.roll(dry[:, ::-1], round(seconds * SR), axis=0)
        self.mix -= self.mix.mean(axis=0)
        rms = np.sqrt(np.mean(self.mix ** 2))
        gain = 10 ** (target_rms_db / 20) / rms
        # Keep at least 4 dB of sample headroom; no hard limiting/clipping.
        gain = min(gain, 10 ** (-4 / 20) / np.max(np.abs(self.mix)))
        self.mix *= gain
        return self.mix


CAFE_CHORDS = [
    (36, [52, 59, 62, 67]), (33, [55, 59, 60, 64]),
    (38, [53, 60, 64, 69]), (31, [53, 59, 64, 69]),
    (29, [52, 57, 60, 67]), (40, [55, 59, 62, 67]),
    (38, [53, 60, 64, 69]), (31, [53, 59, 64, 69]),
    (36, [52, 59, 62, 67]), (33, [55, 59, 60, 64]),
    (29, [52, 57, 60, 67]), (40, [56, 62, 65, 71]),
    (33, [55, 59, 60, 64]), (38, [53, 60, 64, 69]),
    (31, [53, 59, 64, 69]), (31, [53, 59, 64, 69])]

CITY_CHORDS = [
    (41, [57, 60, 64, 67]), (40, [55, 59, 62, 67]),
    (33, [55, 60, 64, 67]), (38, [54, 60, 64, 69]),
    (38, [53, 60, 64, 69]), (31, [53, 59, 64, 69]),
    (36, [52, 59, 62, 67]), (33, [55, 60, 64, 67]),
    (38, [53, 60, 64, 69]), (31, [53, 59, 64, 69]),
    (40, [55, 59, 62, 67]), (33, [55, 61, 64, 67]),
    (38, [53, 60, 64, 69]), (31, [53, 59, 64, 69]),
    (36, [52, 59, 62, 67]), (31, [53, 59, 64, 69])]

# Original melodic phrases: onset in beats within bar, MIDI pitch, duration in beats.
CAFE_MELODY = [
    [(0.5, 64, .75), (1.75, 67, .5), (2.5, 74, .75)],
    [(0.5, 72, .8), (1.75, 71, .45), (2.5, 69, .8)],
    [(0.75, 69, .65), (1.75, 65, .55), (3., 64, .55)],
    [(0.25, 62, .7), (1.5, 64, .5), (2.5, 67, .9)],
    [(0.5, 69, .7), (1.75, 72, .55), (2.75, 76, .6)],
    [(0.5, 74, .7), (1.75, 71, .65), (3., 67, .55)],
    [(0.5, 65, .7), (1.75, 64, .5), (2.75, 62, .6)],
    [(0.75, 59, .6), (2., 62, .7)],
    [(0.5, 67, .7), (1.5, 71, .55), (2.5, 76, .8)],
    [(0.25, 74, .65), (1.5, 72, .6), (2.75, 69, .6)],
    [(0.75, 67, .65), (1.75, 69, .55), (2.75, 72, .65)],
    [(0.5, 71, .7), (1.75, 68, .5), (2.75, 65, .55)],
    [(0.5, 64, .75), (1.75, 67, .55), (2.75, 69, .6)],
    [(0.5, 65, .65), (1.75, 64, .5), (2.75, 62, .65)],
    [(0.5, 64, .6), (1.75, 62, .7), (3., 59, .6)],
    [(0.75, 62, .6), (2., 67, .75)]]

CITY_MELODY = [
    [(0.25, 69, .4), (1., 72, .35), (1.75, 76, .65), (3., 74, .4)],
    [(0.5, 71, .4), (1.25, 67, .4), (2., 74, .6), (3.25, 71, .35)],
    [(0.25, 72, .4), (1., 76, .4), (2., 79, .7), (3.25, 76, .35)],
    [(0.5, 78, .45), (1.25, 76, .35), (2.25, 72, .4), (3., 69, .55)],
    [(0.25, 69, .45), (1., 72, .35), (2., 77, .65), (3.25, 76, .35)],
    [(0.5, 74, .45), (1.25, 71, .4), (2.25, 69, .5), (3.25, 67, .3)],
    [(0.25, 67, .45), (1., 71, .4), (2., 76, .65), (3.25, 74, .35)],
    [(0.5, 72, .5), (1.5, 69, .5), (3., 67, .4)],
    [(0., 77, .65), (1.25, 76, .35), (2., 72, .4), (3., 69, .5)],
    [(0.5, 71, .4), (1.25, 74, .4), (2.25, 76, .65), (3.5, 74, .25)],
    [(0.25, 79, .55), (1.25, 78, .4), (2., 74, .55), (3.25, 71, .4)],
    [(0.5, 73, .4), (1.25, 76, .45), (2.25, 79, .45), (3.25, 76, .3)],
    [(0.25, 77, .5), (1.25, 76, .4), (2.25, 72, .5), (3.25, 69, .3)],
    [(0.5, 74, .5), (1.5, 71, .45), (2.5, 69, .4), (3.25, 67, .3)],
    [(0.25, 64, .4), (1., 67, .4), (2., 71, .55), (3.25, 72, .35)],
    [(0.5, 74, .45), (1.25, 71, .45), (2.5, 67, .65)]]


def compose(style):
    cafe = style == "cafe-lounge"
    loop = Loop(84 if cafe else 112, 8407 if cafe else 11207)
    chords = CAFE_CHORDS if cafe else CITY_CHORDS
    melody = CAFE_MELODY if cafe else CITY_MELODY
    for bar, (root, chord) in enumerate(chords):
        b = bar * 4
        # Keys voice-leading and syncopation differ between the two arrangements.
        placements = [(0., 1.55, .068), (2.5, .85, .048)] if cafe else [
            (.0, .8, .059), (1.5, .45, .047), (2.75, .65, .052)]
        for onset, length, gain in placements:
            for i, pitch in enumerate(chord):
                loop.note(b + onset + i * .018, pitch, length, "keys", gain,
                          -.35 + i * .22)
        if bar in (0, 4, 8, 12):
            for i, pitch in enumerate(chord[1:]):
                loop.note(b, pitch, 3.8, "pad", .018 if cafe else .015, -.65 + i * .65)
        bass_pattern = [(0., root, 1.45), (2., root + 7, .7), (3.25, root + 12, .4)] if cafe else [
            (0., root, .68), (.75, root + 12, .32), (1.5, root + 7, .4),
            (2.25, root, .45), (3., root + 12, .35), (3.75, chords[(bar + 1) % 16][0] - 1, .2)]
        for onset, pitch, length in bass_pattern:
            loop.note(b + onset, pitch, length, "bass", .19 if cafe else .21, 0)
        for onset, pitch, length in melody[bar]:
            loop.note(b + onset, pitch, length, "keys" if cafe else "lead",
                      .12 if cafe else .115, .13)
        if cafe:
            # Light brushed pocket with a 58% swung offbeat.
            for beat in (0., 2.):
                loop.drum(b + beat, "kick", .10)
            for beat in (1., 3.):
                loop.drum(b + beat, "brush", .11, -.15)
                loop.drum(b + beat, "rim", .045, -.25)
            for i in range(8):
                beat = i // 2 + (.58 if i % 2 else 0)
                loop.drum(b + beat, "hat", .033 if i % 2 else .026, .35)
            if bar in (3, 7, 11, 15):
                loop.note(b + 3.5, chord[-1] + 12, .32, "bell", .035, -.4)
        else:
            for beat in (0., 1.75, 2.5):
                loop.drum(b + beat, "kick", .175)
            for beat in (1., 3.):
                loop.drum(b + beat, "snare", .115, -.12)
            for i in range(8):
                loop.drum(b + i / 2, "hat", .049 if i % 2 else .032, .38)
            loop.drum(b + 3.5, "open-hat", .04, .42)
            for onset in (.5, 1.5, 2.5, 3.5):
                for pitch in chord[-3:]:
                    loop.note(b + onset, pitch, .15, "guitar", .027, -.5)
            if bar in (3, 7, 11, 15):
                for j in range(3):
                    loop.drum(b + 3.25 + j * .25, "snare", .033 + j * .006, -.15)
    samples = loop.finish(-23 if cafe else -21)
    return loop, samples


def write_wav(path, samples):
    pcm = np.rint(np.clip(samples, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as out:
        out.setnchannels(2)
        out.setsampwidth(2)
        out.setframerate(SR)
        out.writeframes(pcm.tobytes())


def read_wav(path):
    with wave.open(str(path), "rb") as inp:
        frames = inp.getnframes()
        assert inp.getframerate() == SR and inp.getnchannels() == 2
        assert inp.getsampwidth() == 2
        pcm = np.frombuffer(inp.readframes(frames), dtype="<i2").reshape(-1, 2)
    return pcm.astype(np.float64) / 32768


def signal_metrics(samples):
    differences = np.diff(samples, axis=0)
    seam = samples[0] - samples[-1]
    edges = np.vstack((differences[-2205:], seam[None], differences[:2205]))
    return {
        "sampleFrames": len(samples), "durationSeconds": len(samples) / SR,
        "samplePeakDbfs": db(np.max(np.abs(samples))),
        "rmsDbfs": db(np.sqrt(np.mean(samples ** 2))),
        "channelDcOffset": samples.mean(axis=0).tolist(),
        "clippedSamples": int(np.count_nonzero(np.abs(samples) >= .99997)),
        "loopBoundary": {
            "lastToFirstDelta": seam.tolist(),
            "lastToFirstMaximumDeltaDbfs": db(np.max(np.abs(seam))),
            "neighboring100msMaximumStepDbfs": db(np.max(np.abs(edges))),
            "method": "Compare last→first adjacent-sample step with adjacent steps within 50 ms on each side; no silence padding/fade-to-zero.",
            "wrappedTails": True,
        },
    }


def loudness(path):
    cmd = ["ffmpeg", "-hide_banner", "-nostdin", "-threads", "1", "-i", str(path),
           "-filter_threads", "1", "-af", "loudnorm=I=-20:TP=-2:LRA=11:print_format=json",
           "-f", "null", "-"]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    raw = result.stderr[result.stderr.rfind("{"):]
    # ffmpeg can append its output summary after the filter's JSON object.
    values, _ = json.JSONDecoder().raw_decode(raw)
    # This is analysis only; the filter output is discarded, never used as the artifact.
    return {"integratedLufs": float(values["input_i"]),
            "truePeakDbtp": float(values["input_tp"]),
            "loudnessRangeLu": float(values["input_lra"]),
            "method": "ffmpeg loudnorm input statistics (EBU R128 / ITU-R BS.1770)"}


def waveform_svg(path, samples):
    width, height = 1000, 130
    blocks = np.array_split(samples.mean(axis=1), width)
    lines = []
    for x, block in enumerate(blocks):
        peak = float(np.max(np.abs(block)))
        lines.append(f'<path d="M{x} {65-peak*150:.2f} V{65+peak*150:.2f}"/>')
    svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 130" role="img" aria-label="Audio waveform">'
    svg += '<rect width="1000" height="130" fill="#111827"/><g stroke="#93c5fd" stroke-width="1">'
    path.write_text(svg + ''.join(lines) + '</g></svg>\n')


def encode_ogg_and_manifests(manifest):
    for track in manifest["tracks"]:
        wav = ROOT / track["wav"]["path"]
        ogg = OUT / f"{track['id']}.ogg"
        subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-nostdin",
                        "-threads", "1", "-i", str(wav), "-c:a", "libvorbis", "-q:a", "5",
                        "-ar", str(SR), "-ac", "2", "-threads", "1", str(ogg)], check=True)
        track["ogg"] = {"path": str(ogg.relative_to(ROOT)), "bytes": ogg.stat().st_size,
                        "sha256": hashlib.sha256(ogg.read_bytes()).hexdigest(),
                        "codec": "Vorbis", "quality": 5, **loudness(ogg)}
        with tempfile.TemporaryDirectory(prefix="a01-ogg-decode-") as temp:
            decoded = Path(temp) / "decoded.wav"
            subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-nostdin",
                            "-threads", "1", "-i", str(ogg), "-c:a", "pcm_s16le", "-ar", str(SR),
                            "-ac", "2", "-threads", "1", str(decoded)], check=True)
            track["ogg"]["decodedSignal"] = signal_metrics(read_wav(decoded))
        track["loopStartFrame"] = 0
        track["loopEndFrame"] = track["wav"]["sampleFrames"]
        track["sampleRate"] = SR
        track["channels"] = 2
        track["purpose"] = "cafe-lounge" if track["id"] == "cafe-lounge" else "Tokyo-city-pop"
        track["creator"] = "Codex A01 audio-bgm author (original synthesis for Shibuya Capital)"
        track["source"] = {"classification": "original", "thirdPartyMusicOrSamples": [],
                           "evidence": "All melody/chord/rhythm note lists, oscillators and seeded-noise percussion are defined in scripts/external/audio-bgm/render.py; no external asset loads.",
                           "externalSourceUrl": None}
        track["license"] = {"id": "CC0-1.0", "url": "https://creativecommons.org/publicdomain/zero/1.0/",
                            "scope": "New synthesized sound recordings, compositions and generated waveform SVGs; no attribution required. Runtime/repository code excluded."}
        track["verification"] = {"humanListening": "not-performed", "browserPlayback": "not-performed",
                                 "measured": "WAV/MP3/OGG decoded frames, duration, peak, RMS, LUFS, clipping and loop boundary",
                                 "musicalAudition": "Pending parent review using preview.html and boundary-check.wav"}
        (OUT / f"{track['id']}.manifest.json").write_text(json.dumps(track, ensure_ascii=False, indent=2) + "\n")
        print(f"{track['id']}: OGG {track['ogg']['bytes']} bytes, decoded "
              f"{track['ogg']['decodedSignal']['sampleFrames']} frames", flush=True)
    (DOC / "measurements.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


def render():
    OUT.mkdir(parents=True, exist_ok=True)
    DOC.mkdir(parents=True, exist_ok=True)
    ffmpeg_version = subprocess.run(["ffmpeg", "-version"], capture_output=True,
                                    text=True, check=True).stdout.splitlines()[0]
    manifest = {"schemaVersion": 1, "task": "A01", "baseSha": "407236858c287a3060c224967489010e669d1eea",
                "sampleRate": SR, "channels": 2, "pcmBitDepth": 16,
                "ffmpegVersion": ffmpeg_version, "numpyVersion": np.__version__,
                "compositionSource": "scripts/external/audio-bgm/render.py",
                "thirdPartyMusicOrSamples": [],
                "humanListeningVerified": False, "browserPlaybackVerified": False,
                "failures": [],
                "developmentFailureHistory": [
                    {"attempt": "initial-render", "reason": "SyntaxError: missing closing list bracket in metadata serialization; process stopped before synthesis.", "resolved": True},
                    {"attempt": "second-render", "reason": "JSONDecodeError: ffmpeg appended a summary after loudnorm JSON. Audio encoding succeeded; measurement parser corrected to raw_decode.", "resolved": True}],
                "tracks": []}
    for slug in ("cafe-lounge", "shibuya-citypop"):
        print(f"rendering {slug}", flush=True)
        loop, samples = compose(slug)
        wav = OUT / f"{slug}.wav"
        mp3 = OUT / f"{slug}.mp3"
        write_wav(wav, samples)
        subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-nostdin",
                        "-threads", "1", "-i", str(wav), "-c:a", "libmp3lame",
                        "-b:a", "160k", "-ar", str(SR), "-ac", "2", "-threads", "1",
                        "-write_xing", "1", str(mp3)], check=True)
        wav_samples = read_wav(wav)
        track = {"id": slug, "title": "窓辺の午後" if slug == "cafe-lounge" else "坂道のネオン",
                 "bpm": loop.bpm, "bars": 16, "timeSignature": "4/4",
                 "durationSeconds": loop.seconds, "loopStartSeconds": 0,
                 "loopEndSeconds": loop.seconds, "events": len(loop.events),
                 "normalization": "RMS gain with sample peak ceiling -4 dBFS; no clipping limiter",
                 "wav": {"path": str(wav.relative_to(ROOT)), "bytes": wav.stat().st_size,
                         "sha256": hashlib.sha256(wav.read_bytes()).hexdigest(),
                         **signal_metrics(wav_samples), **loudness(wav)},
                 "mp3": {"path": str(mp3.relative_to(ROOT)), "bytes": mp3.stat().st_size,
                         "sha256": hashlib.sha256(mp3.read_bytes()).hexdigest(),
                         "bitrateKbps": 160, **loudness(mp3)}}
        with tempfile.TemporaryDirectory(prefix="a01-decode-") as temp:
            decoded = Path(temp) / "decoded.wav"
            subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-nostdin",
                            "-threads", "1", "-i", str(mp3), "-c:a", "pcm_s16le", "-ar", str(SR),
                            "-ac", "2", "-threads", "1", str(decoded)], check=True)
            track["mp3"]["decodedSignal"] = signal_metrics(read_wav(decoded))
        waveform_svg(OUT / f"{slug}-waveform.svg", wav_samples)
        # The boundary excerpt gives reviewers an explicit seam at its midpoint.
        two = OUT / f"{slug}-boundary-check.wav"
        one_second = SR
        # Boundary audition excerpt: last 2 s of loop followed by first 2 s.
        write_wav(two, np.concatenate((wav_samples[-2*one_second:], wav_samples[:2*one_second])))
        track["boundaryAudition"] = {"path": str(two.relative_to(ROOT)), "seconds": 4,
                                    "joinAtSeconds": 2, "bytes": two.stat().st_size}
        manifest["tracks"].append(track)
        print(f"{slug}: {loop.seconds:.6f}s, {track['wav']['integratedLufs']} LUFS, "
              f"{track['wav']['truePeakDbtp']} dBTP", flush=True)
    encode_ogg_and_manifests(manifest)
    (OUT / "loop-metadata.json").write_text(json.dumps({"sampleRate": SR,
         "tracks": [{"id": t["id"], "frames": t["wav"]["sampleFrames"],
                     "durationSeconds": t["durationSeconds"]} for t in manifest["tracks"]]}, indent=2) + "\n")
    print("measurements written", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--encode-ogg-only", action="store_true",
                        help="Add/refresh OGG and manifests for already rendered WAV/MP3 files")
    args = parser.parse_args()
    if args.encode_ogg_only:
        encode_ogg_and_manifests(json.loads((DOC / "measurements.json").read_text()))
    else:
        render()

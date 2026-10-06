#!/usr/bin/env python3
"""Publish an already verified build through the repository's existing Pages branch.

The source checkout stays intact. Deployment uses a separate Git tree and a normal
fast-forward push; it neither changes Pages settings nor forces a branch update.
"""
import argparse
import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def git(*args, data=None):
    return subprocess.run(["git", *args], cwd=ROOT, input=data, capture_output=True, check=True).stdout.decode().strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True, help="Verified package-web.py report")
    parser.add_argument("--repository", default="shirai0765/-")
    parser.add_argument("--source-branch", default="game-source")
    parser.add_argument("--pages-branch", default="main")
    parser.add_argument("--publish", action="store_true", help="Create and push the deployment commit")
    args = parser.parse_args()
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", args.repository):
        raise ValueError("Invalid repository")
    for branch in [args.source_branch, args.pages_branch]:
        git("check-ref-format", "refs/heads/" + branch)
    if args.source_branch == args.pages_branch:
        raise ValueError("Source and publication branches must differ")
    remote = git("remote", "get-url", "origin").removesuffix(".git")
    if remote not in {f"https://github.com/{args.repository}", f"git@github.com:{args.repository}"}:
        raise ValueError("Repository does not match origin")
    if git("status", "--porcelain"):
        raise ValueError("Commit the source checkout before preparing a release")

    manifest = json.loads(args.manifest.read_text())
    version = json.loads((ROOT / "package.json").read_text())["version"]
    if manifest["version"] != version:
        raise ValueError("Build report and source versions differ")
    checks = manifest["checks"]
    if checks.get("zipCRC") != "passed" or not checks.get("everyDistFileSHA256MatchesArchive") or not checks.get("distUnchangedDuringPackaging"):
        raise ValueError("Build report is not verified")
    dist = ROOT / "dist"
    files = {}
    for path in dist.rglob("*"):
        if path.is_symlink():
            raise ValueError(f"Symbolic link in distribution: {path.name}")
        if path.is_file():
            files[path.relative_to(dist).as_posix()] = path.read_bytes()
    expected = manifest["files"]
    if files.keys() != expected.keys():
        raise ValueError("Distribution file set differs from verified build")
    for name, content in files.items():
        if hashlib.sha256(content).hexdigest() != expected[name]["sha256"]:
            raise ValueError(f"Distribution differs from verified build: {name}")

    source = git("rev-parse", "HEAD")
    published_source = git("ls-remote", "origin", "refs/heads/" + args.source_branch).split()
    if not published_source or published_source[0] != source:
        raise ValueError("Push this exact source commit to the source branch first")
    git("fetch", "origin", args.pages_branch)
    parent = git("rev-parse", "FETCH_HEAD")
    owner, repo = args.repository.split("/")
    url = f"https://{owner}.github.io/{repo}/"
    metadata = {"version": version, "sourceCommit": source, "sourceBranch": args.source_branch,
                "publishedAt": datetime.now(timezone.utc).isoformat(), "verifiedFiles": len(files),
                "verifiedIndexSHA256": expected["index.html"]["sha256"]}
    for name in [".nojekyll", "release.json", "README.md"]:
        if name in files:
            raise ValueError(f"Reserved publication file already exists: {name}")
    files[".nojekyll"] = b""
    files["release.json"] = (json.dumps(metadata, ensure_ascii=False, indent=2) + "\n").encode()
    files["README.md"] = (
        f"# SHIBUYA CAPITAL {version}\n\n"
        f"[ブラウザーで遊ぶ]({url})\n\n"
        "このブランチはビルド済みの公開サイトです。\n\n"
        f"開発用コードと起動手順は [{args.source_branch}](https://github.com/{args.repository}/tree/{args.source_branch}) にあります。\n\n"
        "会社設立、カフェ出店、週次決算、拡大・資金調達を遊べる開発途中版です。"
        "週末にブラウザー内へ自動保存します。ログインやクラウド同期はありません。"
        "別端末へはゲーム内の保存ファイル書き出し・読み込みを使ってください。\n\n"
        f"公開元コミット: `{source}`。ビルド照合情報: [release.json](release.json)。\n"
    ).encode()
    summary = {**metadata, "url": url, "publicationFiles": len(files), "pagesBranch": args.pages_branch,
               "previousPagesCommit": parent, "published": False}
    if args.publish:
        hierarchy = {}
        for name, content in files.items():
            cursor = hierarchy
            parts = name.split("/")
            for part in parts[:-1]:
                cursor = cursor.setdefault(part, {})
            cursor[parts[-1]] = git("hash-object", "-w", "--stdin", data=content)

        def make_tree(directory):
            records = []
            for name, entry in sorted(directory.items()):
                if isinstance(entry, dict):
                    records.append(f"040000 tree {make_tree(entry)}\t{name}\0")
                else:
                    records.append(f"100644 blob {entry}\t{name}\0")
            return git("mktree", "-z", data="".join(records).encode())

        tree = make_tree(hierarchy)
        commit = git("commit-tree", tree, "-p", parent, data=f"Publish Shibuya Capital {version} from {source[:12]}\n".encode())
        git("push", "origin", f"{commit}:refs/heads/{args.pages_branch}")
        summary.update(published=True, pagesCommit=commit)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

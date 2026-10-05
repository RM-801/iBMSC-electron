# iBMSC

[English](README.md) · [简体中文](README.zh-CN.md) · **日本語** · [한국어](README.ko.md)

**Electron** で開発した、無料のクロスプラットフォーム **BMS / PMS** 譜面エディターです。ソースコードを公開しています。[iBMSC 3.0.5 Delta](https://github.com/aqtq314/iBMSC) を移植し、**SeaRay** が開発・保守しています。

- SINGLE、DOUBLE、9キー PMS 譜面の編集に対応。
- NT / BMSE 入力、ロングノート編集、内蔵音声プレビュー。
- 検索・置換、統計、MyO2 ツール、カスタムスキン。
- 英語・簡体字中国語・日本語・韓国語の UI。

## ダウンロード

[ブラウザーで使う](https://rm-801.github.io/iBMSC-electron/) · 音源を読み込むには、音声ファイルまたはフォルダーを選択してください。

現在のバージョン：[Beta 1 · 0.1.38](https://github.com/RM-801/iBMSC-electron/releases/tag/v0.1.38-beta.1)

| バージョン | 使用方法 |
| --- | --- |
| [Windows x64 インストーラー版](https://github.com/RM-801/iBMSC-electron/releases/download/v0.1.38-beta.1/iBMSC-0.1.38-setup-x64.exe) | インストーラーを実行してください。 |
| [Windows x64 ポータブル版](https://github.com/RM-801/iBMSC-electron/releases/download/v0.1.38-beta.1/iBMSC-0.1.38-portable-x64.exe) | インストール不要。ダブルクリックで起動できます。 |
| [macOS Apple Silicon](https://github.com/RM-801/iBMSC-electron/releases/download/v0.1.38-beta.1/iBMSC-0.1.38-mac-arm64.dmg) | M シリーズの Mac 用。DMG を開き、アプリを Applications にドラッグしてください。 |
| [macOS Intel](https://github.com/RM-801/iBMSC-electron/releases/download/v0.1.38-beta.1/iBMSC-0.1.38-mac-x64.dmg) | Intel Mac 用。DMG を開き、アプリを Applications にドラッグしてください。 |

Node.js のインストールは不要です。更新時は新しいバージョンを手動でダウンロードしてください。Linux 版はまだ提供していません。Windows 版は未署名、macOS 版は Apple の公証を受けていません。

## 使い始める

Web 版は初回起動時にブラウザーの言語を使用し、未対応の言語では英語になります。手動で選んだ言語は保存されます。デスクトップ版のシステム言語対応は次回リリースで追加予定です。

1. 展開済みの譜面を開いてください。音源は譜面と同じフォルダーやサブフォルダーに残しておくと、WAV 定義に従って読み込まれます。
2. **F2 / F3** で選択／書き込みツールを切り替え、**F5 / F7** で再生／停止、**Ctrl＋マウスホイール** で編集エリアを拡大・縮小できます。
3. 保存時の文字コードは標準で **UTF-8** です。LR2 などの旧プレイヤーとの互換性が必要な場合は **Shift-JIS** を選択できます。PMS では Pomu の 9 キースキンに自動で切り替わり、標準で `.pms` として保存されます。

## ベータ版の注意事項

- まずは譜面のコピーでお試しください。原版の一部機能や旧プロジェクトとの互換性は、引き続き改善中です。
- `LNTYPE 2` には未対応です。内蔵プレビューでは BGA の画像・動画は表示されません。条件分岐は元の記述を保持しますが、評価・実行はしません。
- GBK の譜面は、読み込み時に文字コードを明示的に選択してください。自動判別は保証されません。

[リリースノート](docs/releases/v0.1.38-beta.1.md) · [不具合の報告](https://github.com/RM-801/iBMSC-electron/issues)（バージョン、OS、再現手順を添えてください）

原作：**iBMS / iBMS.[4th Age]**。本プロジェクトは開発・保守を引き継ぐ派生版です。[原作者・貢献者と権利表記](CREDITS.md) · [第三者ソフトウェアに関する表記](THIRD_PARTY_NOTICES.md) · [開発者向けドキュメント](docs/DEVELOPMENT.md)

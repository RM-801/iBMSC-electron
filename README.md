# iBMSC

**English** · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

A free, cross-platform **BMS / PMS** chart editor built with **Electron**, with publicly available source code. Ported from [iBMSC 3.0.5 Delta](https://github.com/aqtq314/iBMSC) and maintained by **SeaRay**.

- Edit SINGLE, DOUBLE, and nine-key PMS charts.
- Use NT / BMSE input modes, long-note editing, and built-in audio preview.
- Find and replace notes, view statistics, use MyO2 tools, and customize skins.
- Available in English, Simplified Chinese, Japanese, and Korean.

## Download

[Open in your browser](https://rm-801.github.io/iBMSC-electron/) · Select the audio files or their folder to load keysounds.

Current version: [Beta 1 · 0.1.38](https://github.com/RM-801/iBMSC-electron/releases/tag/v0.1.38-beta.1)

| Edition | Getting started |
| --- | --- |
| [Windows x64 installer](https://github.com/RM-801/iBMSC-electron/releases/download/v0.1.38-beta.1/iBMSC-0.1.38-setup-x64.exe) | Run the installer. |
| [Windows x64 portable](https://github.com/RM-801/iBMSC-electron/releases/download/v0.1.38-beta.1/iBMSC-0.1.38-portable-x64.exe) | Double-click to run; no installation required. |
| [macOS Apple Silicon](https://github.com/RM-801/iBMSC-electron/releases/download/v0.1.38-beta.1/iBMSC-0.1.38-mac-arm64.dmg) | For M-series Macs. Open the DMG and drag the app into Applications. |
| [macOS Intel](https://github.com/RM-801/iBMSC-electron/releases/download/v0.1.38-beta.1/iBMSC-0.1.38-mac-x64.dmg) | For Intel Macs. Open the DMG and drag the app into Applications. |

Node.js is not required. Download new versions manually to update. Linux packages are not yet available. Windows packages are unsigned; macOS packages are not notarized by Apple.

## Quick start

The web version starts in your browser language, falls back to English for unsupported languages, and remembers your manual choice. System-language detection for the desktop app is coming in the next release.

1. Extract your chart files before opening them. Keep audio files in the chart folder and its subfolders; the editor resolves them from the chart's WAV definitions.
2. Use **F2 / F3** for the select / write tools, **F5 / F7** to play / stop, and **Ctrl + mouse wheel** to zoom the editor.
3. Charts are saved as **UTF-8** by default. Choose **Shift-JIS** for older players such as LR2. PMS charts automatically use the Pomu nine-key skin and default to the `.pms` extension.

## Beta notes

- Test with copies of your charts first. Some original features and compatibility with older project files are still being refined.
- `LNTYPE 2` is not supported. Built-in preview does not display BGA images or videos. Conditional directives are preserved as text but are not evaluated.
- For GBK charts, select the input encoding explicitly; automatic detection is not guaranteed.

[Full release notes](docs/releases/v0.1.38-beta.1.md) · [Report an issue](https://github.com/RM-801/iBMSC-electron/issues) (include the app version, operating system, and steps to reproduce)

Original authors: **iBMS / iBMS.[4th Age]**. This project continues development as a maintained fork. [Credits and licensing notes](CREDITS.md) · [Third-party notices](THIRD_PARTY_NOTICES.md) · [Developer documentation](docs/DEVELOPMENT.md)

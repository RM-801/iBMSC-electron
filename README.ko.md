# iBMSC

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · **한국어**

**Electron**으로 만든 무료 크로스 플랫폼 **BMS / PMS** 채보 편집기로, 소스 코드가 공개되어 있습니다. [iBMSC 3.0.5 Delta](https://github.com/aqtq314/iBMSC)를 기반으로 이식했으며 **SeaRay**가 유지보수합니다.

- SINGLE, DOUBLE, 9키 PMS 채보 편집을 지원합니다.
- NT / BMSE 입력, 롱노트 편집, 내장 오디오 미리 듣기를 제공합니다.
- 찾기·바꾸기, 통계, MyO2 도구와 사용자 지정 스킨을 지원합니다.
- 영어·중국어 간체·일본어·한국어 UI를 제공합니다.

## 다운로드

[브라우저에서 사용하기](https://rm-801.github.io/iBMSC-electron/) · 키음을 불러오려면 음원 파일 또는 폴더를 선택하세요.

현재 버전: [Beta 2 · 0.1.39](https://github.com/RM-801/iBMSC-electron/releases/tag/v0.1.39-beta.2)

| 버전 | 사용 방법 |
| --- | --- |
| [Windows x64 설치판](https://github.com/RM-801/iBMSC-electron/releases/download/v0.1.39-beta.2/iBMSC-0.1.39-setup-x64.exe) | 설치 프로그램을 실행하세요. |
| [Windows x64 포터블판](https://github.com/RM-801/iBMSC-electron/releases/download/v0.1.39-beta.2/iBMSC-0.1.39-portable-x64.exe) | 설치 없이 더블 클릭하여 실행하세요. |
| [macOS Apple Silicon](https://github.com/RM-801/iBMSC-electron/releases/download/v0.1.39-beta.2/iBMSC-0.1.39-mac-arm64.dmg) | M 시리즈 Mac용. DMG를 열고 앱을 Applications로 드래그하세요. |
| [macOS Intel](https://github.com/RM-801/iBMSC-electron/releases/download/v0.1.39-beta.2/iBMSC-0.1.39-mac-x64.dmg) | Intel Mac용. DMG를 열고 앱을 Applications로 드래그하세요. |
| [Linux x64 AppImage](https://github.com/RM-801/iBMSC-electron/releases/download/v0.1.39-beta.2/iBMSC-0.1.39-linux-x64.AppImage) | 파일 실행 권한을 허용한 뒤 실행하세요. |
| [Linux x64 DEB](https://github.com/RM-801/iBMSC-electron/releases/download/v0.1.39-beta.2/iBMSC-0.1.39-linux-x64.deb) | `.deb`를 지원하는 시스템에서 소프트웨어 설치 프로그램으로 여세요. |

Node.js를 따로 설치할 필요가 없습니다. 업데이트는 새 버전을 직접 다운로드해야 합니다. Linux는 현재 x64 패키지만 제공하며 ARM 패키지는 아직 없습니다. Windows 패키지는 서명되지 않았으며, macOS 패키지는 Apple 공증을 받지 않았습니다.

## 시작하기

처음 실행할 때 시스템 또는 브라우저 언어를 사용하며, 지원하지 않는 언어는 영어로 표시합니다. 직접 선택한 언어는 저장됩니다.

1. 압축을 푼 채보를 열고 음원은 채보 폴더와 하위 폴더에 그대로 두세요. 웹에서는 **WAV → 음원 불러오기 상태 → 음원 폴더 선택**에서 해당 폴더를 선택하면 채보의 키음을 불러옵니다.
2. **F2 / F3**으로 선택 / 입력 도구를 전환하고, **F5 / F7**로 재생 / 정지합니다. **Ctrl＋마우스 휠**로 편집 영역을 확대·축소할 수 있습니다.
3. 기본 저장 인코딩은 **UTF-8**입니다. LR2 등 기존 플레이어와의 호환성이 필요하면 **Shift-JIS**를 선택하세요. PMS는 자동으로 Pomu 9키 스킨을 사용하며 기본 저장 확장자는 `.pms`입니다.

웹 버전의 터치 조작: 한 손가락으로 밀어 화면을 이동하고, 두 손가락으로 확대·축소합니다. 탭하면 현재 도구로 선택하거나 입력합니다. 빈 곳을 길게 누른 뒤 드래그하면 영역을 선택하고, 노트를 길게 누른 뒤 드래그하면 이동합니다.

## Beta 안내

- 먼저 채보 사본으로 테스트하세요. 일부 원본 기능과 이전 프로젝트 형식의 호환성은 아직 개선 중입니다.
- `LNTYPE 2`는 지원하지 않습니다. 내장 미리 듣기는 BGA 이미지·동영상을 표시하지 않으며, 조건 분기는 원문만 보존하고 실행하지 않습니다.
- GBK 채보는 읽기 인코딩을 직접 선택해야 합니다. 자동 인식을 보장하지 않습니다.

[전체 릴리스 노트](docs/releases/v0.1.39-beta.2.md) · [문제 신고](https://github.com/RM-801/iBMSC-electron/issues) — 버전, 운영체제, 재현 방법을 함께 알려 주세요.

원작: **iBMS / iBMS.[4th Age]**. 이 프로젝트는 후속 유지보수 분기입니다. [원작·기여자 및 라이선스 안내](CREDITS.md) · [서드파티 고지](THIRD_PARTY_NOTICES.md) · [개발 문서](docs/DEVELOPMENT.md)

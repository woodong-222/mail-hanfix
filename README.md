# Koreatech HanFix

macOS에서 웹메일로 파일 업로드 시 한글 파일명이 자소 분리되는 현상을 자동으로 변환하는 Chrome 확장 프로그램입니다.

## 한 줄 요약

웹메일 첨부 시 NFD로 깨지는 한글 파일명을 NFC로 정리합니다.

## 문제

macOS의 파일시스템 API가 파일명을 NFD 형태로 반환하기 때문에, 브라우저에서 파일을 업로드하면 한글 파일명이 초성+중성+종성으로 분해되어 전송됩니다.

```
보내는 파일: 인덱스.txt
받는 쪽에서: ㅇㅣㄴㄷㅔㄱㅅㅡ.txt
```

## 설치

(권장) 크롬 웹스토어에서 `Koreatech HanFix` 설치

혹은

1. 확장 프로그램 등록 화면(`chrome://extensions`) 접속
2. 우측 상단 **개발자 모드** 활성화
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. 이 폴더(`KoreatechHanFix`) 선택

## 사용법

설치 후 자동으로 동작합니다.

- 확장 프로그램 아이콘 클릭
- 토글로 활성화/비활성화 가능

## 동작 확인된 메일

- https://mail.google.com/ (@gmail.com)
- https://mail.naver.com/ (@naver.com)
- https://portal.koreatech.ac.kr/ (@koreatech.ac.kr)

사용 추가 등록 요청 및 다른 되는 사이트 발견 시 ehddn2004@gmail.com 메일로 알려주시면 감사하겠습니다.

## 특정 사이트에서만 동작시키기

`manifest.json`의 `matches`를 수정:

```json
"content_scripts": [
  {
    "matches": ["https://mail.company.com/*"],
    ...
  }
]
```

# VITALL 탐사 게시판

생태연구회 VITALL의 탐사 공지·신청 웹사이트입니다. 사이트 소스와 자동 배포 설정을 제공합니다.

## 웹 화면을 먼저 공개하기

1. [저장소의 Pages 설정](https://github.com/kaiyen475/mygit/settings/pages)을 엽니다.
2. **Build and deployment → Source → GitHub Actions**를 선택합니다.
3. [Actions](https://github.com/kaiyen475/mygit/actions)에서 **Publish VITALL preview**를 선택하고 **Run workflow**를 누릅니다.

배포 성공 후 접속할 주소: **https://kaiyen475.github.io/mygit/**

이 화면은 미리보기입니다. 예시 탐사를 조회할 수 있으며 신청 정보를 저장하지 않습니다. 실제 신청 기능은 아래 서버 배포를 완료하면 사용할 수 있습니다.

## 실제 신청 기능 배포

[DEPLOY.md](DEPLOY.md)에 Cloudflare Worker + D1 설정 방법이 있습니다. 운영자 비밀번호를 서버의 비밀 값으로 설정하고, 공용 데이터베이스에 신청 정보를 저장합니다.

- 누구나 회원가입 없이 신청
- 이름, 전화번호, 쌍안경·장화 대여, 집합 장소, 탐사 후 식사 여부
- 카테고리별 게시판 및 지난 탐사 조회
- 공개 화면에는 신청자 이름과 인원만 표시
- 운영자 비밀번호 인증 후 공지 작성·수정, 전체 신청 정보·준비 합계·CSV 확인
- 서버에서 마감·정원·중복 신청·개인정보 공개 범위 검사

처음 표시되는 탐사는 예시입니다. 운영자가 실제 탐사를 등록하면 신청을 받습니다. 운영자 비밀번호와 실제 신청자 정보는 저장소에 포함되지 않습니다.

## 개발·검증

Node 24 이상에서 외부 패키지 설치 없이 실행합니다.

```sh
node --no-warnings scripts/verify-free.mjs
node --no-warnings build-free.mjs
```

로컬 실행은 Python 3.10 이상에서 `python3 server.py --open`을 사용합니다. 시작할 때 운영자 비밀번호를 설정하며, 신청 정보는 로컬 `.vitall-data/vitall.db`에 저장됩니다.

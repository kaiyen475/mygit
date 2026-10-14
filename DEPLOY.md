# VITALL 공개 배포

## 먼저 공개 화면 열기

처음에는 [Settings → Pages](https://github.com/kaiyen475/mygit/settings/pages)에서 **Build and deployment → Source → GitHub Actions**를 선택하세요. 이어서 [Actions](https://github.com/kaiyen475/mygit/actions)에서 **Publish VITALL preview → Run workflow**를 실행하세요. 성공 후 접속할 주소는 **https://kaiyen475.github.io/mygit/** 입니다. 이후 `main`에 변경 사항을 올리면 같은 워크플로가 자동으로 다시 배포합니다. GitHub의 기본 워크플로 토큰으로는 Pages를 처음 활성화할 수 없어 이 설정이 한 번 필요합니다.

이 주소는 **화면 미리보기**입니다. 게시판과 예시 탐사를 둘러볼 수 있으며, 신청 저장과 운영자 로그인은 아래 Cloudflare 배포를 완료한 사이트에서 사용합니다. 비공개 저장소는 이 미리보기 배포를 건너뜁니다.

## 실제 신청 받기

1. Cloudflare 계정을 만들고 **Workers & Pages**에서 `workers.dev` 주소를 준비하세요. **D1 → Create database**에서 이름을 `vitall`로 만든 뒤 **Database ID**와 계정의 **Account ID**를 복사하세요.
2. Cloudflare **My Profile → API Tokens → Create Token**에서 해당 계정에 **Account / Workers Scripts / Edit**와 **Account / D1 / Edit** 권한을 가진 API 토큰을 만드세요.
3. GitHub 저장소 **Settings → Secrets and variables → Actions**에 다음 값을 등록하세요.

| 위치 | 이름 | 입력값 |
| --- | --- | --- |
| Secrets | `CLOUDFLARE_API_TOKEN` | Cloudflare에서 만든 API 토큰 |
| Secrets | `ADMIN_PASSWORD` | 정한 운영자 비밀번호 |
| Variables | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| Variables | `CLOUDFLARE_D1_DATABASE_ID` | `vitall` D1의 Database ID |

4. **Actions → Deploy VITALL to Cloudflare → Run workflow**를 실행하세요. 완료된 실행 요약이나 배포 로그의 `https://vitall-field-notes.…workers.dev` 주소가 실제 사이트입니다. 회원가입 없이 이 링크로 신청할 수 있습니다.

실제 사이트의 **관리자** 버튼에서 설정한 비밀번호를 입력해 탐사 공지를 작성하세요. 일반 방문자는 신청자 이름과 인원만, 운영자는 전화번호·대여·집합 장소·식사 정보를 확인합니다. 처음 화면의 예시 탐사는 신청을 받지 않습니다.

수정 후에는 `main`에 올리고 Cloudflare 워크플로를 다시 실행하세요. 데이터베이스는 그대로 유지되며, 이미 적용한 SQL 마이그레이션은 다시 실행하지 않습니다. 비밀번호를 바꿀 때에는 `ADMIN_PASSWORD` Secret을 수정하고 같은 워크플로를 실행하세요. 첫 배포에서 비밀번호가 설정되기 전까지 운영자 로그인은 거부됩니다.

GitHub Pages에는 서버가 없어 신청 정보를 저장할 수 없습니다. Cloudflare는 Worker 서버와 D1 데이터베이스를 함께 운영합니다. `.dev.vars`, `.env`와 `.sites-runtime`은 Git에 올리지 않으며, 비밀번호와 API 토큰을 소스 코드에 입력하지 마세요. 아직 GitHub/Cloudflare에서 워크플로를 실행하지 않았다면 공개 사이트 배포는 완료되지 않은 상태입니다.

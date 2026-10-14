# VITALL 실제 신청 사이트 배포

실제 신청 저장과 운영자 로그인은 Cloudflare Worker 서버와 D1 데이터베이스에서 실행합니다. 배포 작업이 D1 생성, 테이블 준비, 서버 배포, 운영자 비밀번호 등록을 자동으로 수행합니다.

## 처음 한 번 설정

1. [Cloudflare](https://dash.cloudflare.com/)에 로그인하거나 계정을 만드세요. **Workers & Pages**를 열고 `workers.dev` 주소가 준비되어 있는지 확인하세요. 계정의 **Account ID** 32자도 복사해 둡니다.
2. [API Tokens](https://dash.cloudflare.com/profile/api-tokens)에서 **Create Token → Create Custom Token**을 선택하세요. 이름은 `VITALL deploy`로 하고, 아래 두 권한을 추가합니다. **Account Resources**는 배포에 사용할 계정 하나만 선택하세요.

| 대상 | 권한 | 수준 |
| --- | --- | --- |
| Account | Workers Scripts | Edit |
| Account | D1 | Edit |

3. [GitHub Actions Secrets](https://github.com/kaiyen475/mygit/settings/secrets/actions)에서 **New repository secret**을 눌러 아래 세 값을 등록하세요. 토큰은 채팅이나 소스 코드에 보내지 않고 이 설정에만 넣습니다.

| Secret 이름 | 입력할 값 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | 위에서 만든 API 토큰 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 계정의 32자 Account ID |
| `ADMIN_PASSWORD` | 설정할 운영자 비밀번호 |

D1 Database ID를 직접 찾거나 데이터베이스를 만들 필요가 없습니다. 워크플로가 `vitall-field-notes` 데이터베이스를 찾아 재사용하고, 없으면 만듭니다. 이미 준비한 D1을 쓰려면 선택적으로 `CLOUDFLARE_D1_DATABASE_ID`를 Secret 또는 Variable에 넣을 수 있습니다.

## 배포

[Actions → Deploy VITALL to Cloudflare](https://github.com/kaiyen475/mygit/actions/workflows/deploy.yml)에서 **Run workflow**를 누릅니다. 설정 전 실패한 실행이 있다면 **Re-run failed jobs**를 선택해도 됩니다. 이후 `main`에 코드가 바뀌면 자동으로 배포합니다.

성공한 실행의 요약이나 Wrangler 로그에 표시되는 `https://vitall-field-notes.…workers.dev` 주소가 실제 신청 사이트입니다. 이 링크에서는 회원가입 없이 탐사에 신청할 수 있습니다. 첫 배포에서 비밀번호가 등록되기 전까지 운영자 로그인은 거부됩니다.

사이트의 **관리자** 버튼에서 설정한 비밀번호를 입력하고 실제 탐사를 등록하세요. 일반 방문자는 신청자 이름과 인원만, 운영자는 전화번호·쌍안경/장화 대여·집합 장소·식사 정보를 확인합니다. 처음 표시되는 예시 탐사는 신청을 받지 않습니다.

데이터베이스는 재배포해도 유지되며, 이미 적용한 마이그레이션은 반복 실행하지 않습니다. 비밀번호를 바꿀 때에는 `ADMIN_PASSWORD` Secret을 수정한 뒤 워크플로를 다시 실행하세요.

## 현재 실제 사이트

https://vitall-field-notes.ki955725.workers.dev/ 에서 실제 신청 저장과 운영자 로그인을 사용할 수 있습니다. https://kaiyen475.github.io/mygit/ 도 이 실제 사이트로 연결합니다. GitHub Pages 연결 주소는 deployment.json에서 관리합니다.

`.dev.vars`, `.env`, `.sites-runtime`과 실제 신청자 데이터는 저장소에 올리지 않습니다. GitHub와 Cloudflare의 비밀 설정에 넣은 값은 소스나 브라우저에 공개되지 않습니다.

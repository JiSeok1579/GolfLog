# Golf Swing Personal AI 진행 정리

작성일: 2026-04-30

## 확인 결과

- `golf_swing_personal_ai_implementation_guide.md`의 최종 목표는 개인 골격, ROM, 현재 스윙, 클럽 궤적을 함께 분석해서 사용자 몸에 맞는 목표 스윙과 리포트를 제공하는 것이다.
- 가이드의 초기 구조는 FastAPI + Python pose 모델 + React UI를 전제로 한다.
- 현재 앱은 개인 로컬 사용 전용으로 전환되어 있으며 Vite 프론트엔드와 Node 로컬 API가 이미 동작한다.
- 따라서 지금 단계에서는 서버를 새로 늘리지 않고 기존 로컬 Node API에 Phase 0 분석 흐름을 붙인다.
- 실제 2D/3D pose 모델, MMPose, MediaPipe, PyTorch, IK solver 설치는 Phase 1 이후로 분리한다.

## 현재 운영 원칙

- 외부 공개 없음.
- 내부망 공개 없음.
- nginx 사용 없음.
- 개인 컴퓨터에서 `http://127.0.0.1:5173/`로만 사용.
- API는 `127.0.0.1:3001`에서 실행.
- 데이터는 `/Volumes/X31/golflog-data/golflog.json`에 저장.
- 운영 데이터와 영상은 Git에 올리지 않음.
- 코드 변경은 phase별 브랜치/PR로 커밋, 머지함.

## 단계별 진행 계획

### Phase 0: 분석 골격과 UI

목표: 실제 AI 모델 없이도 분석 API, 결과 스키마, 화면 흐름을 먼저 고정한다.

- [x] 분석 결과 TypeScript/Zod 스키마 추가
- [x] `POST /api/analysis` mock 분석 생성 API 추가
- [x] `GET /api/analysis/{analysis_id}` 결과 조회 API 추가
- [x] `GET /api/analysis/{analysis_id}/status` 상태 조회 API 추가
- [x] `GET /api/analysis/{analysis_id}/frames/{frame}` 프레임 조회 API 추가
- [x] 프론트엔드 `스윙 AI` 화면과 라우팅 추가
- [x] 영상 선택, 클럽, 촬영 각도, 주 사용 손 입력 UI 추가
- [x] mock skeleton, club line overlay 표시
- [x] mock biomechanical summary, phase, recommendation 표시

남은 보완:

- [x] 실제 영상 바이너리 업로드 저장 구조 추가
- [x] 분석 기록 목록과 이전 결과 다시 열기
- [x] 프레임 seek와 overlay 동기화
- [x] 실제 영상 없이 확인 가능한 예시 분석 생성
- [x] `.venv/bin/python` 자동 감지와 공개 샘플 영상 기반 worker/normalizer 검증
- [x] 저작권/데이터 운영 정책과 Git payload 검사 추가

### Phase 1: 2D Golfer + Club Pose

목표: 영상에서 사람 keypoint와 클럽 keypoint를 추출한다.

- [x] Node API에서 `multipart/form-data` 영상 업로드 수신
- [x] 업로드 영상을 로컬 데이터 디렉터리의 `videos/` 하위에 저장
- [x] 분석 job 상태를 `queued/processing/completed/failed`로 관리
- [x] Node에서 `workers/pose/analyze_pose.py` worker 실행
- [x] worker raw output을 `SwingAnalysisResult` 스키마로 정규화
- [x] 정규화 결과를 로컬 데이터 디렉터리의 `analysis/` 하위에 저장
- [x] 프론트엔드에서 status polling 후 결과 조회
- [x] video currentTime 기준으로 가까운 pose frame overlay 표시
- [ ] MediaPipe 의존성 설치 후 실제 영상에서 keypoint 검증
- [ ] 클럽 head/grip 전용 검출 모델 또는 보정 UI 추가

예시 데이터 운영 원칙:

- GolfDB(`https://github.com/wmcnally/golfdb`)는 스윙 sequencing 검증 후보로 둔다.
- GolfDB 코드/샘플은 CC BY-NC 4.0 기준이므로 개인·연구용 검증에만 사용한다.
- 외부 영상·데이터셋 원본은 운영 데이터로만 보관하고 Git에는 올리지 않는다.
- 모델 파일·가중치·샘플 영상·운영 데이터는 `NOTICE.md`, `docs/COPYRIGHT_AND_DATA_POLICY.md`, `npm run check:payload` 기준으로 관리한다.
- 개인 실제 스윙이 생기기 전까지는 앱 내 예시 분석과 저장된 공개 샘플의 로컬 업로드로 UI/API 흐름을 검증한다.
- 2026-05-01 기준 Python 3.13용 MediaPipe wheel은 `mp.solutions`가 노출되지 않아 기본 worker는 안전한 fallback pose로 UI/API를 검증한다.
- MediaPipe Tasks 모델은 `/Volumes/X31/golflog-data/models/pose_landmarker_full.task`에 로컬 보관하며, 네이티브 런타임 안정화 후 명시적으로 켠다.

완료 기준:

- frame별 body keypoint 저장
- club grip/head 추정 저장
- overlay가 실제 추정값으로 표시

### Phase 2: Swing Phase Segmentation

목표: Address, Takeaway, Top, Downswing, Impact, Finish 등 이벤트를 자동 분할한다.

- [x] pose/club trajectory rule 기반 자동 분할 구현
- [x] Address, Takeaway, Top, Downswing, Impact, Follow Through, Finish를 `phases` JSON으로 출력
- [x] Top/Impact/Finish 주요 이벤트를 pose frame에서 휴리스틱으로 추정
- [x] 영상 하단 phase timeline marker 추가
- [x] phase 목록 클릭 시 해당 프레임으로 seek
- [x] recommendation 클릭 시 관련 phase로 seek
- [ ] GolfDB/SwingNet 계열 모델 검토 및 교체 가능성 평가
- [ ] 수동 phase 보정 UI 추가

### Phase 3: 3D Pose Estimation

목표: 2D pose를 3D skeleton으로 복원한다.

- 단일 카메라부터 시작한다.
- 가능하면 GolfPose-3D, VideoPose3D, MixSTE 계열을 검토한다.
- 2-view 촬영은 카메라 보정 UI가 필요하므로 후순위로 둔다.

### Phase 4: Body Profile & ROM

목표: 사용자의 키, 신체 비율, 관절 가동범위를 추천 조건에 반영한다.

- 키와 segment ratio를 사용자 프로필과 연결한다.
- ROM 입력 화면을 추가한다.
- 추천 rule에서 ROM constraint를 참조한다.

### Phase 5: Biomechanical Feature Engine

목표: head sway, pelvis sway, shoulder turn, x-factor, club path, balance risk 등을 계산한다.

- feature 계산은 독립 패키지로 분리 가능하게 만든다.
- 리포트와 추천은 같은 feature JSON을 참조한다.

### Phase 6: Recommendation Engine

목표: 단순 비교가 아니라 사용자 몸 기준으로 권장 범위를 제안한다.

- 초기에는 rule-based로 구현한다.
- 각 추천은 phase, metric, value, drill을 포함한다.
- 이후 사용자별 개선 추세를 반영한다.

### Phase 7 이후: Retargeting, IK, Ghost Swing

목표: 상급자 reference swing을 사용자 골격과 ROM에 맞춰 변환하고 ghost swing overlay를 제공한다.

- reference swing library 필요
- segment length normalization 필요
- ROM violation penalty 필요
- IK solver 도입 필요

## 검증 결과

- `npm run build` 통과.
- 로컬 API LaunchAgent 재시작 완료.
- 임시 테스트 API에서 회원 등록 후 `POST /api/analysis` 201 응답 확인.
- `GET /api/analysis/{analysis_id}/status` 200 응답 확인.
- `GET /api/analysis/{analysis_id}/frames/{frame}` 200 응답 확인.
- `http://127.0.0.1:5173/swing-ai` 응답 확인.

## 다음 실행 순서

1. Python 3.11 legacy `mp.solutions` 또는 Python 3.13 MediaPipe Tasks 중 안정적인 pose runtime 확정
2. GolfDB 등 공개 샘플 영상에서 실제 keypoint 품질 확인
3. 클럽 head/grip 추정 고도화
4. 수동 phase 보정 UI 추가

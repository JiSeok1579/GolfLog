# AI Pose Model Agent Guide

작성일: 2026-05-01

## 목적

GolfLog의 Swing AI pose/model 작업을 이어갈 때 지켜야 할 현재 구현 기준과 문서 위치를 정리한다. 이 파일은 모델 파일이나 데이터셋을 포함하지 않는 작업 가이드다.

## 현재 구조

- 앱은 개인 localhost 전용이다.
- 프론트엔드는 Vite/React이고 `http://127.0.0.1:5173/`에서 실행한다.
- API는 Node 로컬 서버이고 `http://127.0.0.1:3001`에서 실행한다.
- 운영 데이터는 `/Volumes/X31/golflog-data/golflog.json`에 저장한다.
- 업로드 영상, 분석 결과, 모델 파일은 Git 밖 로컬 데이터 디렉터리에 둔다.
- Python pose worker는 Node API에서 실행한다.

## 구현 상태

- MediaPipe solutions 기반 2D body keypoint baseline이 있다.
- MediaPipe 네이티브 실패 시 fallback pose output으로 API job이 계속 진행된다.
- OpenCV Hough line 기반 club shaft 후보 검출이 있다.
- `GOLFLOG_CLUB_DETECTOR_COMMAND`로 외부 club head/grip 모델 command를 연결할 수 있다.
- phase 자동 분할은 rule 기반 baseline이다.
- phase/club 수동 보정 UI와 저장 API가 있다.
- phase/club 보정 후 tempo, club path, Impact/Overall 점수, club path 추천은 재계산된다.
- 3D pose, ROM, 개인 골격 기반 retargeting, IK ghost swing은 아직 구현 전이다.

## Model Agent Roles

- Pose Video Analysis Agent: 영상에서 2D pose, keypoint confidence, frame drop, fallback 여부를 정의한다.
- Swing Phase Detection Agent: address, takeaway, top, downswing, impact, follow-through, finish 구간 로직과 신뢰도를 정의한다.
- Biomechanics Scoring Agent: head sway, shoulder/hip turn, spine angle, arm bend, tempo 같은 2D proxy metric과 점수식을 정의한다.
- GolfLog Historical Data Agent: `sessions`, `clubShots`, 향후 `healthEntries`와 분석 결과를 연결해 개인 baseline 비교 방식을 정의한다.
- Personalized Performance Modeling Agent: 충분한 같은 클럽 기록이 있을 때 개인 패턴과 추천 우선순위를 정의한다.
- Score Calibration Agent: proxy 점수의 범위, 가중치, 충분/제한/부족 데이터 기준을 조정한다.
- Safety / Coaching Guardrail Agent: fallback, 낮은 confidence, 건강/통증 관련 표현, 과도한 인과 주장 방지를 정의한다.

일반 Codex 구현은 프론트엔드, 로컬 Node 서버, 디자인, 라우팅, 호환성, 저장소, 빌드 안정성을 담당한다. 모델 중심 역할은 pose metric, 점수 공식, 기록 비교, 추천 로직, confidence 처리, 안전 문구를 정의하는 데 한정한다.

## Required AI Coach Output

- `analysisQuality`
- `phaseScores`
- `bodyMovementScores`
- `historicalComparison`
- final score 또는 fallback 시 `N/A`
- confidence
- evidence, reason, suggestion, drill, safety note를 포함한 1-3개 추천

## 주요 문서

- `docs/SWING_AI_PROGRESS_PLAN.md`: 현재 진행 상황과 다음 작업 순서
- `docs/CLUB_MODEL_ADAPTER.md`: 외부 club detector command 입출력 계약
- `docs/COPYRIGHT_AND_DATA_POLICY.md`: 저작권, 데이터, 모델 파일 운영 정책
- `workers/pose/README.md`: pose worker 실행과 검증 명령
- `golf_swing_personal_ai_implementation_guide.md`: 장기 목표와 구현 지침

## 금지 사항

Git에 올리지 않는다:

- 사용자 기록과 운영 데이터
- 업로드한 스윙 영상
- GolfDB 등 공개 샘플 영상 원본
- 모델 가중치와 모델 bundle
- `.task`, `.onnx`, `.pt`, `.pth`, `.ckpt`, `.npy`, `.npz`, `.pkl` 등 모델/데이터 artifact
- 생성 preview 이미지와 로컬 QA 결과물

커밋 전에는 반드시 실행한다:

```bash
npm run check:payload
```

## 기본 검증

```bash
npm run build
node --check server/server.js
npm run check:payload
npm run check:pose -- --require-real /path/to/swing.mp4
npm run inspect:pose -- --require-real /path/to/swing.mp4 /tmp/golflog-pose-quality.md
```

macOS 샌드박스나 비 GUI 셸에서는 MediaPipe가 fallback으로 떨어질 수 있다. 실제 pose 검증은 일반 로컬 실행 환경에서 확인한다.

## 다음 작업 후보

1. 전용 club head/grip 모델 command를 확보하고 `GOLFLOG_CLUB_DETECTOR_COMMAND`로 연결한다.
2. GolfDB/SwingNet 계열 phase 모델을 검토하고 rule 기반 phase baseline과 비교한다.
3. 실제 본인 스윙 영상으로 keypoint, club path, phase 보정 workflow를 검증한다.
4. `SwingAiPage.tsx`와 `server/server.js`에 집중된 기능을 작은 컴포넌트/analysis module로 분리한다.

# Club Model Adapter

작성일: 2026-05-01

## 목적

전용 학습 모델 기반 club head/grip 검출은 모델 가중치와 데이터셋을 Git에 올리지 않는 조건으로 연결한다. GolfLog repo에는 모델 실행 계약과 fallback 코드만 둔다.

## 로컬 실행 계약

pose worker는 `GOLFLOG_CLUB_DETECTOR_COMMAND`가 설정되어 있으면 sampled frame마다 해당 명령을 실행한다. 명령은 아래 환경 변수를 입력으로 받는다.

| 환경 변수 | 내용 |
| --- | --- |
| `GOLFLOG_CLUB_FRAME_IMAGE` | 현재 sampled frame JPG 경로 |
| `GOLFLOG_CLUB_POSE_JSON` | MediaPipe body keypoints JSON 경로 |
| `GOLFLOG_CLUB_FRAME_INDEX` | 원본 영상 기준 frame index |
| `GOLFLOG_CLUB_TOTAL_FRAMES` | 원본 영상 frame count |
| `GOLFLOG_CLUB_FRAME_WIDTH` | frame width |
| `GOLFLOG_CLUB_FRAME_HEIGHT` | frame height |
| `GOLFLOG_CLUB_VIEW_ANGLE` | 촬영 각도 |
| `GOLFLOG_CLUB_TYPE` | 클럽 종류 |
| `GOLFLOG_DOMINANT_HAND` | 주 사용 손 |

명령은 stdout으로 아래 JSON을 출력한다.

```json
{
  "grip": { "x": 620.4, "y": 420.1 },
  "head": { "x": 760.2, "y": 250.8 },
  "score": 0.91,
  "source": "golfpose-local"
}
```

좌표는 원본 frame 기준 pixel-space이다. `score`는 0-1 범위 confidence이다.

## detector mode

| mode | 동작 |
| --- | --- |
| `auto` | 외부 명령이 있으면 먼저 실행하고 실패 시 OpenCV baseline으로 fallback |
| `external` | 외부 명령만 사용 |
| `opencv` | 내장 OpenCV shaft-line detector만 사용 |
| `off` | worker club 검출을 끄고 Node normalizer의 손목 기반 가상 club만 사용 |

예시:

```bash
GOLFLOG_CLUB_DETECTOR=auto \
GOLFLOG_CLUB_DETECTOR_COMMAND="/Volumes/X31/golflog-data/models/club_detector/run_detector" \
npm run check:pose -- --require-real /path/to/swing.mp4
```

## Git 운영 원칙

- 모델 가중치, 학습 데이터, 샘플 영상, 생성 preview는 Git에 올리지 않는다.
- 모델 파일은 `/Volumes/X31/golflog-data/models/` 등 로컬 데이터 디렉터리에만 둔다.
- `npm run check:payload`로 `.task`, `.onnx`, `.pt`, 영상 파일 등이 추적되지 않는지 확인한다.
- 외부 모델의 라이선스, 데이터셋 출처, 사용 범위는 `docs/COPYRIGHT_AND_DATA_POLICY.md`에 맞춰 별도 기록한다.

## 현재 상태

현재 repo에는 전용 club 모델이 없다. 기본 동작은 `auto` mode에서 외부 명령 미설정 상태이므로 내장 OpenCV detector가 사용된다. 학습 모델을 준비하면 위 명령 계약만 맞춰 연결하고, 품질은 `npm run inspect:pose`의 Club Detection 섹션에서 확인한다.

# 저작권 및 데이터 운영 정책

GolfLog는 개인 로컬 사용을 기준으로 만든 애플리케이션이다. 이 저장소에는 앱 실행에 필요한 소스 코드, 설정 템플릿, 문서만 포함한다. 사용자 데이터, 업로드 영상, 공개 샘플 영상, 데이터셋, AI 모델 파일, 모델 가중치, 다운로드한 모델 번들은 운영 데이터로 취급하고 Git에 올리지 않는다.

## 저작권 고지

GolfLog의 원본 소스 코드, 문서, UI 문구, 프로젝트 전용 설정의 저작권은 별도 표시가 없는 한 저장소 소유자에게 있다.

명시적인 `LICENSE` 파일 또는 서면 허가가 없는 한, 이 저장소의 원본 코드와 문서에 대해 재사용, 재배포, 재라이선스, 상업적 사용 권한을 부여하지 않는다.

이 프로젝트는 로컬 검증을 위해 외부 도구, AI 모델, 데이터셋, 샘플 영상을 참조할 수 있다. 참조는 해당 외부 자산을 이 저장소에서 재배포한다는 의미가 아니다. 외부 자산은 각 자산의 라이선스와 이용 조건을 따라야 한다.

## Git에 올리면 안 되는 항목

다음 항목은 커밋하거나 GitHub에 업로드하지 않는다.

- 사용자 입력 데이터와 운영 데이터 파일
- `/Volumes/X31/golflog-data/golflog.json`
- 업로드한 개인 스윙 영상, 스크린 녹화, 분석 결과 원본
- GolfDB 등 공개 데이터셋의 샘플 영상 원본
- `.task`, `.tflite`, `.onnx`, `.pt`, `.pth`, `.ckpt`, `.h5`, `.pb`, `.mlmodel` 등 AI 모델 파일과 가중치
- `.parquet`, `.npy`, `.npz`, `.pkl`, 로컬 DB, 원본 CSV 등 raw/processed dataset artifact
- `.venv/`, dependency folder, cache, macOS AppleDouble 파일

## 로컬 보관 위치

운영 데이터와 외부 자산은 Git 밖의 로컬 경로에 둔다.

```bash
/Volumes/X31/golflog-data/golflog.json
/Volumes/X31/golflog-data/models/
/tmp/
```

현재 앱은 개인 로컬 API 데이터 파일에 사용자 기록을 저장한다. 이 기록은 GitHub에 올리는 대상이 아니다.

## 공개 샘플 데이터

개인 실제 스윙 영상이 없을 때 GolfDB는 swing-analysis pipeline 검증용 공개 샘플 후보로만 사용한다. GolfDB는 CC BY-NC 4.0 조건이므로 개인/연구 검증용으로만 사용하고, 샘플 영상 파일 자체는 이 저장소로 재배포하지 않는다.

출처:

- https://github.com/wmcnally/golfdb
- https://github.com/wmcnally/golfdb/blob/master/LICENSE

## 외부 AI 모델

MediaPipe Pose Landmarker 모델 번들은 필요할 때 로컬로 다운로드하고 Git에는 올리지 않는다. 이 프로젝트의 기본 로컬 경로는 다음과 같다.

```bash
/Volumes/X31/golflog-data/models/pose_landmarker_full.task
```

참고:

- https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker

## 커밋 전 검사

AI, 영상, 데이터 관련 작업 후에는 커밋 전에 다음 명령을 실행한다.

```bash
npm run check:payload
```

이 검사는 Git이 모델 파일, 샘플 영상, 로컬 데이터베이스, 데이터셋 artifact를 추적하고 있으면 실패한다.

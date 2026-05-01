# 개인화 골프 스윙 자세 분석·최적화 모델 구현 지침서

작성일: 2026-04-30  
대상: 로컬/개인 사용에서 시작하되, 원래 목표인 **개인 골격·ROM 기반 최적 움직임 제안, IK 기반 ghost swing, 모션 리타겟팅, biomechanical report**까지 확장 가능한 구현  
권장 스택: Python + FastAPI + PyTorch/MMPose + React/Next.js 또는 Vite + Three.js/Canvas Overlay

---

## 0. 목표 정의

이 프로젝트의 최종 목표는 단순히 “프로 자세와 비교해서 틀린 점을 찾는 앱”이 아니다.

최종 목표는 다음과 같다.

> 사용자의 신체 골격 비율, 관절 가동범위, 현재 스윙 패턴, 클럽 궤적을 분석하고, 사용자의 몸에 맞는 안전하고 효율적인 목표 스윙 궤적과 관절 각도 시퀀스를 제안하는 개인화 골프 스윙 AI 코치.

따라서 모델은 아래 기능을 모두 지원해야 한다.

1. 영상 기반 골퍼 + 클럽 검출
2. 2D keypoint 추정
3. 3D skeleton 복원
4. 스윙 phase 자동 분할
5. 신체 segment length 및 골격 비율 추정
6. ROM 테스트 기반 관절 가동범위 추정
7. biomechanical feature 계산
8. 오류/위험/비효율 패턴 탐지
9. 프로/상급자 모션을 사용자 골격에 맞게 retargeting
10. IK constraint를 적용한 ghost swing 생성
11. 영상 위 skeleton, club path, ghost swing overlay
12. 개인화 리포트 생성

---

## 1. 시스템 아키텍처

### 1.1 전체 구조

```text
golf-swing-personal-ai/
 ├─ apps/
 │   ├─ frontend/                    # React/Next/Vite UI
 │   └─ local_server/                # FastAPI local API server
 │
 ├─ packages/
 │   ├─ pose2d/                      # 2D golfer/club pose estimation
 │   ├─ pose3d/                      # 2D-to-3D lifting, triangulation
 │   ├─ swing_phase/                 # Golf swing event detection
 │   ├─ biomechanics/                # feature extraction, angle, COM, safety
 │   ├─ body_profile/                # skeleton scaling, ROM analysis
 │   ├─ retargeting/                 # motion retargeting
 │   ├─ ik_solver/                   # inverse kinematics
 │   ├─ recommendation/              # rule/ranking-based feedback engine
 │   └─ visualization/               # overlay JSON utilities
 │
 ├─ data/
 │   ├─ raw_videos/
 │   ├─ processed_frames/
 │   ├─ pose2d/
 │   ├─ pose3d/
 │   ├─ analysis_results/
 │   ├─ body_profiles/
 │   ├─ reference_swings/
 │   └─ datasets/
 │
 ├─ models/
 │   ├─ detectors/
 │   ├─ pose2d/
 │   ├─ pose3d/
 │   ├─ swing_phase/
 │   └─ retargeting/
 │
 ├─ configs/
 │   ├─ keypoints.yaml
 │   ├─ biomech_thresholds.yaml
 │   ├─ model_registry.yaml
 │   └─ camera_profiles.yaml
 │
 ├─ scripts/
 │   ├─ download_public_datasets.md
 │   ├─ prepare_golfdb.py
 │   ├─ prepare_golfpose.py
 │   ├─ train_phase_model.py
 │   ├─ run_pose2d.py
 │   ├─ run_pose3d.py
 │   └─ run_full_analysis.py
 │
 ├─ tests/
 └─ docs/
```

### 1.2 로컬 실행 구성

초기 실행은 다음처럼 한다.

```bash
# backend
cd apps/local_server
uvicorn main:app --reload --host 127.0.0.1 --port 8000

# frontend
cd apps/frontend
npm run dev
```

프론트엔드는 `http://localhost:3000`, 백엔드는 `http://localhost:8000`에서 실행한다.

> 현재 GolfLog repo에서는 FastAPI를 새로 띄우지 않고 기존 Node 로컬 API를 우선 사용한다. 자세한 현재 구현 반영 사항은 문서 하단의 `15. 현재 GolfLog 로컬 구현 반영 사항 및 다음 구현 지침`을 따른다.

---

## 2. 필수 라이브러리

### 2.1 Python

```txt
python>=3.10
fastapi
uvicorn
pydantic
python-multipart
opencv-python
numpy
scipy
pandas
tqdm
matplotlib
pyyaml
torch
torchvision
torchaudio
mmengine
mmdet
mmpose
mediapipe
ultralytics
filterpy
scikit-learn
xgboost
joblib
```

### 2.2 3D, IK, Retargeting

```txt
trimesh
open3d
pytorch3d
smplx
pin
pin-pink
casadi
```

선택 사항:

```txt
opensim
biorbd
mujoco
```

### 2.3 프론트엔드

```txt
react
typescript
vite 또는 next
zustand
@tanstack/react-query
three
@react-three/fiber
framer-motion
lucide-react
```

영상/Canvas overlay:

```txt
konva
react-konva
```

또는 SVG overlay만으로 시작 가능하다.

---

## 3. 참고 모델·데이터셋

### 3.1 GolfDB

목적: 스윙 phase/event detection 학습 및 평가

GolfDB는 골프 스윙 시퀀싱을 위한 대표 데이터셋이다. GitHub 구현체에는 SwingNet baseline이 포함되어 있으며, GolfDB는 8개 골프 스윙 이벤트를 탐지하는 task를 제공한다.

- Repo: https://github.com/wmcnally/golfdb
- Paper: GolfDB: A Video Database for Golf Swing Sequencing
- 주요 사용처:
  - 스윙 이벤트 프레임 탐지
  - Address, Toe-up, Mid-backswing, Top, Mid-downswing, Impact, Mid-follow-through, Finish 분할
  - phase-aware feature extraction 기준 제공

### 3.2 GolfPose / GolfSwing

목적: 골퍼 + 클럽 pose estimation

GolfPose는 일반 pose model이 골프 스윙의 rare pose, self-occlusion, club interaction에서 흔들리는 문제를 해결하기 위해 GolfSwing dataset으로 HRNet, ViTPose, DEKR, MixSTE 등을 fine-tuning한 프로젝트다.

- Repo: https://github.com/MingHanLee/GolfPose
- Paper: GolfPose: From Regular Posture to Golf Swing Posture
- 특징:
  - golfer + club pose
  - detector checkpoint
  - golfer/person/club pose checkpoint
  - 2D/3D GolfPose 모델
  - ViTPose, HRNet, DEKR, MixSTE 기반

필수적으로 확인할 것:

```text
GolfPose/
 ├─ golfswing/
 │   ├─ coco/
 │   ├─ data_2d_golf_gt.npz
 │   ├─ data_3d_golf_gt.npz
 │   └─ images/
 └─ golfpose_checkpoints/
```

데이터셋은 권한 요청이 필요할 수 있다. 사용 가능하면 이 프로젝트의 핵심 데이터셋으로 둔다.

### 3.3 AthletePose3D

목적: 고속 스포츠 동작의 3D pose estimation 일반화 및 validation

- Paper/Open access: AthletePose3D, CVPRW 2025
- Repo: https://github.com/calvinyeungck/AthletePose3D
- 사용처:
  - 빠른 스포츠 동작에서 monocular 3D pose model fine-tuning
  - velocity/acceleration estimation 한계 검증
  - 일반 H36M 기반 모델이 스포츠 동작에서 오차가 커지는 문제 확인

### 3.4 Human3.6M, MPI-INF-3DHP, COCO, Halpe

목적: 기본 2D/3D pose pretraining

- Human3.6M: 3D human pose 기본 benchmark
- MPI-INF-3DHP: outdoor/indoor 3D pose
- COCO: 2D keypoint
- Halpe: whole-body keypoints

### 3.5 AMASS / SMPL / SMPL-X

목적: body model, segment length, retargeting, shape estimation

- SMPL/SMPL-X는 사용자 신체 비율을 parametric human body로 정규화하는 데 사용한다.
- 영상 기반 정확한 신체 치수 추정은 어렵기 때문에, skeleton segment ratio + 사용자의 키 입력값을 결합한다.

---

## 4. 구현 우선순위

이 문서는 타협형 MVP가 아니라 원래 목표를 구현하기 위한 설계다. 다만 개발은 phase로 나누어야 한다.

### Phase 0: 프로젝트 골격

목표:

- repo 구조 생성
- FastAPI + React 연결
- 영상 업로드/분석 결과 조회 API
- 분석 결과 JSON schema 고정
- mock result로 UI 완성

산출물:

```text
POST /api/analysis
GET /api/analysis/{analysis_id}
GET /api/analysis/{analysis_id}/frames/{frame}
```

완료 기준:

- 프론트에서 영상 업로드 가능
- mock skeleton overlay 가능
- mock recommendation 표시 가능

### Phase 1: 2D Golfer + Club Pose

목표:

- 영상에서 골퍼와 클럽 검출
- 2D body keypoints와 club keypoints 추출
- confidence, smoothing, interpolation 처리

권장 순서:

1. MediaPipe Pose로 baseline 구현
2. MMPose + RTMPose/ViTPose로 교체
3. GolfPose checkpoint 사용 가능 시 golfer+club pose로 교체
4. club head, grip, shaft keypoint 별도 검출

완료 기준:

- 각 frame에 body keypoints 저장
- club head/grip 추정 가능
- skeleton overlay와 club path overlay 표시 가능

### Phase 2: Swing Phase Segmentation

목표:

- GolfDB/SwingNet 기반 스윙 이벤트 탐지
- 또는 pose sequence 기반 Transformer/TCN 학습

입력:

```text
video frames
또는
2D pose sequence + club head trajectory
```

출력:

```json
[
  {"name": "address", "frame": 12, "time": 0.20},
  {"name": "takeaway", "frame": 38, "time": 0.63},
  {"name": "top", "frame": 94, "time": 1.56},
  {"name": "impact", "frame": 132, "time": 2.20},
  {"name": "finish", "frame": 214, "time": 3.56}
]
```

완료 기준:

- 주요 8개 이벤트 자동 검출
- 수동 보정 UI 제공
- phase별 feature extraction 가능

### Phase 3: 3D Pose Estimation

목표:

- 2D pose trajectory를 3D skeleton으로 lift
- 단일 카메라와 2-view camera 모두 지원

단일 카메라:

- VideoPose3D
- MixSTE
- MotionBERT 계열
- GolfPose-3D 사용 가능 시 우선

2-view:

- camera calibration
- triangulation
- reprojection error minimization
- temporal smoothing

완료 기준:

- frame별 3D keypoints 저장
- pelvis-centered coordinate와 camera coordinate 둘 다 저장
- 주요 관절 각도 계산 가능

### Phase 4: Body Profile & ROM

목표:

- 사용자 골격 비율 추정
- ROM 테스트로 관절 가동범위 측정
- 스윙 추천에 constraint로 반영

필수 ROM 테스트:

1. 어깨 회전
2. 흉추 회전
3. 골반/고관절 회전
4. 손목 코킹/신전
5. 발목 dorsiflexion
6. hip hinge
7. squat 또는 lunge stability

출력:

```json
{
  "heightCm": 178,
  "armTorsoRatio": 1.11,
  "legTorsoRatio": 1.24,
  "shoulderPelvisRatio": 1.18,
  "thoracicRotationLeftDeg": 68,
  "thoracicRotationRightDeg": 72,
  "hipInternalRotationLeftDeg": 34,
  "hipInternalRotationRightDeg": 39,
  "wristExtensionDeg": 58,
  "wristRadialDeviationDeg": 21
}
```

완료 기준:

- 사용자 프로필 JSON 저장
- 각 추천 rule에서 ROM constraint 참조 가능

### Phase 5: Biomechanical Feature Engine

목표:

- 신체/스윙/안전성 feature 계산
- phase별 feature와 전체 trajectory feature 생성

필수 feature:

#### Body geometry

```text
arm_torso_ratio
leg_torso_ratio
shoulder_pelvis_width_ratio
femur_tibia_ratio
stance_width_ratio
address_spine_angle
```

#### Swing kinematics

```text
head_sway
pelvis_sway
spine_angle_change
shoulder_turn_top
pelvis_turn_top
x_factor
x_factor_stretch
lead_knee_flexion
trail_knee_stability
wrist_cock_angle
hand_path_radius
club_shaft_plane
club_head_path
impact_hand_forward_lean
early_extension_score
```

#### Safety

```text
lumbar_extension_proxy
knee_valgus_proxy
excessive_lateral_sway
wrist_overcock_risk
shoulder_external_rotation_risk
balance_margin
```

완료 기준:

- 모든 feature가 JSON에 저장됨
- 리포트와 overlay에서 feature 참조 가능

### Phase 6: Recommendation Engine

목표:

- 사용자의 체형/ROM/스윙 feature 기반 피드백 생성
- 단순 “틀렸다”가 아니라 “당신 몸 기준 권장 범위”로 생성

처음에는 rule-based로 구현하고 이후 ranking model로 확장한다.

예시 rule:

```yaml
- id: late_pelvis_lead
  condition:
    phase: transition
    metric: pelvis_lead_time
    operator: ">"
    threshold: 0.08
  constraints:
    hip_rom_min: 30
  output:
    title: "다운스윙 전환에서 골반 리드가 늦습니다"
    reason: "상체와 팔이 먼저 내려와 임팩트 전 회전 에너지 전달이 약해질 수 있습니다."
    suggestion: "탑 이후 왼쪽 골반을 먼저 여는 전환 cue를 사용하세요."
    safety_note: "허리 회전으로 억지 보상하지 말고 고관절 회전 범위 안에서 수행하세요."
```

완료 기준:

- 추천 3~5개 우선순위 생성
- 각 추천은 feature, phase, body constraint와 연결됨
- 리포트에서 근거 수치 표시

### Phase 7: Motion Retargeting

목표:

- 프로/상급자 reference swing을 사용자 골격에 맞춰 변환
- 좌표 복사가 아니라 운동 패턴을 보존한다

복사할 feature:

```text
pelvis-thorax sequencing
transition timing
club shaft plane trend
hand path topology
impact hand-club relation
balance pattern
```

그대로 복사하지 말 것:

```text
absolute hand position
professional max shoulder turn
professional wrist lag
professional knee flexion
absolute top height
```

Retargeting process:

```text
reference swing 3D
→ phase alignment
→ root normalization
→ segment length normalization
→ user skeleton scaling
→ ROM constraint clipping
→ IK refinement
→ ghost swing export
```

완료 기준:

- 사용자 skeleton length를 반영한 ghost pose sequence 생성
- ROM 초과 관절 angle이 없음
- ghost swing overlay 가능

### Phase 8: IK Solver

목표:

- 목표 hand/club path와 joint constraints를 만족하는 관절 각도 sequence 생성
- injury risk를 최소화하는 목표 posture 생성

Loss function:

```text
L =
  w_ref   * pose_similarity(reference_features, candidate_features)
+ w_rom   * ROM_violation(candidate_joint_angles, user_ROM)
+ w_joint * anatomical_joint_limit_violation
+ w_smooth* temporal_smoothness
+ w_path  * club_path_error
+ w_bal   * balance_penalty
+ w_safe  * injury_risk_penalty
```

IK 라이브러리 후보:

- Pinocchio
- Pink
- OpenSim
- CasADi custom optimization
- PyTorch differentiable IK

완료 기준:

- 사용자 ROM 초과 없이 목표 pose 생성
- frame 간 discontinuity 없음
- candidate ghost swing이 영상 overlay로 시각화 가능

### Phase 9: Frontend Visualization

목표:

- 사용자가 영상을 보면서 즉시 이해할 수 있도록 한다

필수 UI:

```text
영상 플레이어
현재 skeleton overlay
ghost skeleton overlay
club path trail
phase timeline
joint angle panel
recommendation cards
body profile card
before/after comparison
manual phase correction
```

완료 기준:

- frame seek 시 overlay 동기화
- skeleton/ghost/club path toggle 가능
- 추천 클릭 시 해당 phase로 이동

---

## 5. Keypoint 설계

### 5.1 Body keypoints

기본 17점 COCO만으로는 부족하다. 골프는 spine, pelvis, hand, foot, club이 중요하다.

권장 keypoint:

```yaml
body:
  - nose
  - neck
  - left_shoulder
  - right_shoulder
  - left_elbow
  - right_elbow
  - left_wrist
  - right_wrist
  - left_hand
  - right_hand
  - sternum
  - spine_mid
  - pelvis_center
  - left_hip
  - right_hip
  - left_knee
  - right_knee
  - left_ankle
  - right_ankle
  - left_heel
  - right_heel
  - left_toe
  - right_toe
```

### 5.2 Club keypoints

```yaml
club:
  - grip_top
  - grip_bottom
  - shaft_mid
  - club_head
  - club_face_proxy
```

### 5.3 Derived virtual points

```yaml
virtual:
  - shoulder_center
  - hip_center
  - torso_axis
  - pelvis_axis
  - hand_center
  - stance_center
  - center_of_mass_proxy
```

---

## 6. 데이터 스키마

### 6.1 AnalysisResult

```ts
export type AnalysisResult = {
  analysisId: string;
  userId?: string;
  video: VideoMeta;
  camera: CameraMeta;
  swingPhases: SwingPhase[];
  pose2d: Pose2DFrame[];
  pose3d?: Pose3DFrame[];
  clubPath?: ClubPathFrame[];
  bodyProfile?: BodyProfile;
  biomechFeatures: BiomechFeatureSet;
  ghostSwing?: GhostSwingFrame[];
  scores: SwingScores;
  recommendations: Recommendation[];
  debug?: DebugInfo;
};
```

### 6.2 Pose2DFrame

```ts
export type Pose2DFrame = {
  frame: number;
  time: number;
  keypoints: Record<string, [number, number, number]>;
};
```

### 6.3 Pose3DFrame

```ts
export type Pose3DFrame = {
  frame: number;
  time: number;
  coordinateSystem: "camera" | "pelvis_centered" | "world";
  keypoints: Record<string, [number, number, number, number]>;
};
```

### 6.4 Recommendation

```ts
export type Recommendation = {
  id: string;
  priority: number;
  severity: "info" | "low" | "medium" | "high";
  targetPhase: string;
  title: string;
  evidenceMetrics: Record<string, number>;
  bodyConstraintUsed?: string[];
  reason: string;
  suggestion: string;
  drill?: string;
  safetyNote?: string;
  overlayFrameRange?: [number, number];
};
```

---

## 7. API 설계

### 7.1 분석 시작

```http
POST /api/analysis
Content-Type: multipart/form-data
```

Form fields:

```text
video: File
clubType: driver | wood | iron | wedge | putter
viewAngle: front | side | rear | unknown
dominantHand: right | left
useBodyProfile: true | false
```

Response:

```json
{
  "analysisId": "ana_20260430_001",
  "status": "queued"
}
```

### 7.2 분석 상태

```http
GET /api/analysis/{analysis_id}/status
```

Response:

```json
{
  "analysisId": "ana_20260430_001",
  "status": "processing",
  "progress": 66,
  "currentStage": "pose3d_lifting"
}
```

### 7.3 분석 결과

```http
GET /api/analysis/{analysis_id}
```

Response: `AnalysisResult`

### 7.4 Body Profile 생성

```http
POST /api/body-profile/rom-test
```

Form fields:

```text
video: File
testType: thoracic_rotation | hip_rotation | wrist_cock | shoulder_rotation | ankle_dorsiflexion
```

Response:

```json
{
  "testType": "thoracic_rotation",
  "metrics": {
    "leftDeg": 68,
    "rightDeg": 72,
    "confidence": 0.87
  }
}
```

### 7.5 Reference swing 등록

```http
POST /api/reference-swings
```

Form fields:

```text
video: File
label: string
level: self_best | coach_reference | pro_reference
```

---

## 8. 분석 파이프라인 상세

### 8.1 Full pipeline

```python
def run_full_analysis(video_path, user_profile=None, options=None):
    frames = extract_frames(video_path)

    detection = detect_golfer_and_club(frames)

    pose2d = estimate_pose2d(
        frames=frames,
        detections=detection,
        model="golfpose_vitpose_or_rtmpose"
    )

    pose2d = smooth_and_interpolate_pose2d(pose2d)

    swing_phases = detect_swing_phases(
        frames=frames,
        pose2d=pose2d,
        club_path=extract_club_path(pose2d)
    )

    pose3d = lift_pose2d_to_3d(
        pose2d=pose2d,
        model="golfpose_3d_or_mixste"
    )

    pose3d = fit_skeleton_and_scale(
        pose3d=pose3d,
        user_height=user_profile.height_cm if user_profile else None
    )

    biomech = compute_biomechanical_features(
        pose2d=pose2d,
        pose3d=pose3d,
        phases=swing_phases,
        body_profile=user_profile
    )

    recommendations = generate_recommendations(
        features=biomech,
        body_profile=user_profile
    )

    ghost_swing = None
    if user_profile and options.generate_ghost:
        reference = select_reference_swing(user_profile, biomech)
        ghost_swing = retarget_reference_swing(
            reference=reference,
            user_profile=user_profile,
            constraints=user_profile.rom
        )
        ghost_swing = solve_ik_for_ghost_swing(
            ghost=ghost_swing,
            constraints=user_profile.rom,
            target_club_path=derive_target_club_path(reference)
        )

    return AnalysisResult(...)
```

---

## 9. 모델 학습 전략

### 9.1 Swing phase model

Baseline:

- GolfDB의 SwingNet 사용
- event detection output을 현재 파이프라인 schema로 변환

고도화:

- 입력: pose2d + club trajectory + frame embedding
- 모델: TCN 또는 Transformer Encoder
- Loss: frame-wise cross entropy + event distance loss

출력:

```text
P(event | frame)
```

평가:

```text
PCE: Percentage of Correct Events
MAE in frames
MAE in seconds
```

### 9.2 Pose2D model

Baseline:

- MediaPipe Pose 또는 RTMPose

Production target:

- MMPose + GolfPose checkpoint
- golfer + club keypoints 포함

학습 데이터:

- GolfPose/GolfSwing
- 자체 라벨링 데이터
- COCO/Halpe pretraining

평가:

```text
AP
PCK
per-keypoint confidence
club head localization error
```

### 9.3 Pose3D model

Baseline:

- VideoPose3D
- MixSTE
- GolfPose-3D

고도화:

- AthletePose3D로 sports fine-tuning
- GolfSwing 3D 데이터로 domain adaptation

평가:

```text
MPJPE
PA-MPJPE
joint angle error
phase-specific error
club impact frame stability
```

### 9.4 Recommendation model

초기:

- rule-based
- YAML rule로 관리

고도화:

- ranking model
- 입력: body profile + swing features + user goal
- 출력: recommendation priority

평가:

```text
coach agreement
before/after improvement
user acceptance
injury-risk reduction proxy
```

---

## 10. 자체 데이터셋 구축 지침

공개 데이터만으로는 원래 목표를 달성할 수 없다. 개인화 최적화를 하려면 자체 데이터셋이 필요하다.

### 10.1 촬영 조건

권장:

```text
- 120fps 이상
- 정면 + 측면 2-view
- 카메라 고정
- 전신과 클럽 헤드가 모두 프레임 안에 들어와야 함
- 밝은 조명
- 배경 단순
- 카메라 높이: 골반~가슴 높이
```

### 10.2 수집 항목

```text
- 사용자 키/몸무게/나이/성별 선택사항
- 주사용 손
- 클럽 종류
- 핸디캡 또는 실력 레벨
- 통증/부상 이력
- 정면 스윙 영상
- 측면 스윙 영상
- ROM 테스트 영상
- 가능하면 볼 결과: carry, ball speed, club speed, launch angle, direction
```

### 10.3 최소 규모

```text
PoC: 50명 x 10스윙
Alpha: 300명 x 15스윙
Beta: 1,000명 x 20스윙
고도화: 10,000명 이상
```

### 10.4 라벨링

필수 라벨:

```text
- golfer bbox
- club bbox
- body keypoints
- club keypoints
- swing phase events
- 오류 유형
- 코치 추천
```

라벨링 툴:

```text
CVAT
Label Studio
Roboflow
```

---

## 11. Biomechanical rules 초기 목록

### 11.1 Head sway

```yaml
id: excessive_head_sway
phase: backswing
metric: head_sway_ratio
threshold:
  warning: 0.08
  high: 0.12
body_constraints:
  none
feedback:
  title: "백스윙 중 머리 이동이 큽니다"
  suggestion: "오른쪽으로 밀기보다 흉추 회전으로 백스윙을 만드세요."
```

### 11.2 Early extension

```yaml
id: early_extension
phase: downswing_to_impact
metric: pelvis_toward_ball_displacement
threshold:
  warning: 0.06
  high: 0.10
body_constraints:
  hip_internal_rotation
feedback:
  title: "임팩트 전 골반이 공 쪽으로 밀립니다"
  suggestion: "고관절 회전 여유가 부족하면 스탠스를 약간 오픈하고 힙 힌지를 유지하세요."
```

### 11.3 ROM-aware shoulder turn

```yaml
id: shoulder_turn_exceeds_rom
phase: top
metric: shoulder_turn_top
condition: "shoulder_turn_top > thoracic_rotation_rom * 0.95"
feedback:
  title: "현재 가동범위 대비 백스윙 회전 요구가 큽니다"
  suggestion: "탑을 더 키우기보다 다운스윙 순서와 임팩트 안정성을 우선 개선하세요."
```

### 11.4 Wrist over-cocking

```yaml
id: wrist_over_cocking
phase: top
metric: wrist_cock_angle
condition: "wrist_cock_angle > wrist_rom * 0.95"
feedback:
  title: "손목 가동범위 대비 코킹 요구가 큽니다"
  suggestion: "억지 래그보다 몸통 회전 순서와 릴리즈 타이밍을 우선 조정하세요."
```

---

## 12. 테스트 전략

### 12.1 Unit test

```text
angle calculation
segment length calculation
phase alignment
ROM violation detection
rule engine condition parser
```

### 12.2 Integration test

```text
video upload → pose2d → phase → feature → recommendation → frontend overlay
```

### 12.3 Manual validation

```text
- address frame이 올바른가?
- top frame이 올바른가?
- impact frame이 올바른가?
- skeleton이 영상과 동기화되는가?
- 추천 근거 수치가 실제 영상에서 납득되는가?
- ROM constraint가 무시되지 않는가?
```

---

## 13. 개발자가 지켜야 할 원칙

1. 프로 자세를 그대로 복사하지 않는다.
2. 모든 추천은 사용자 body profile과 ROM constraint를 고려해야 한다.
3. confidence가 낮은 keypoint로 강한 피드백을 만들지 않는다.
4. 2D만으로 확신할 수 없는 내용은 “추정”으로 표시한다.
5. 부상 관련 표현은 의학적 진단처럼 말하지 않는다.
6. ghost swing은 reference 복사가 아니라 retargeted candidate로 표현한다.
7. 모든 feature와 recommendation에는 근거 metric을 남긴다.
8. 프론트 UI는 숫자보다 phase별 시각화를 우선한다.
9. 모델 교체가 가능하도록 pipeline interface를 고정한다.
10. 로컬 개인 사용이라도 데이터 구조는 나중에 확장 가능하게 설계한다.

---

## 14. 최종 개발 로드맵

```text
Phase 0: upload/mock UI/schema
Phase 1: 2D pose + club pose
Phase 2: swing phase segmentation
Phase 3: 3D pose lifting
Phase 4: body profile + ROM
Phase 5: biomechanical feature engine
Phase 6: recommendation engine
Phase 7: motion retargeting
Phase 8: IK ghost swing
Phase 9: frontend comparison/coach UX
Phase 10: dataset expansion and model training
```

각 phase는 이전 phase의 output schema를 깨지 않아야 한다.

---

## 15. 현재 GolfLog 로컬 구현 반영 사항 및 다음 구현 지침

작성일: 2026-04-30  
최종 업데이트: 2026-05-01
대상 repo: `JiSeok1579/GolfLog`  
현재 운영 방식: **개인 컴퓨터 localhost 전용 Vite 프론트엔드 + 기존 Node 로컬 API**  
중요 결정: 현재 단계에서는 FastAPI 서버를 새로 추가하지 않는다. 기존 Node API가 프론트와 로컬 데이터 저장을 담당하고, Python 분석 코드는 **Node에서 호출하는 로컬 worker**로 붙인다.

### 15.1 현재 반영 완료 상태

현재 구현은 Phase 0, Phase 1 baseline, Phase 2 rule baseline이 연결된 상태다. 전용 학습 모델과 3D/ROM/IK 기능은 아직 붙이지 않았다.

반영된 항목:

```text
src/data/schema.ts
- 스윙 분석 결과 타입/스키마 추가
- 프레임별 pose/club/phase/recommendation 구조 추가
- 반복 보정 시 점수 drift를 막기 위한 metric baseline 구조 추가

server/server.js
- POST /api/analysis 추가
- 분석 결과 조회 API 추가
- 분석 status 조회 API 추가
- 분석 frame 조회 API 추가
- Phase 0 mock analysis result 생성
- multipart/form-data 영상 업로드 저장
- 분석 job queued/processing/completed/failed 관리
- phase 보정 저장 API 추가
- club grip/head 수동 보정 저장 API 추가
- phase/club 보정 후 tempo, club path, Impact/Overall 점수, 추천 문구 재계산

server/analysis/runPoseWorker.js
server/analysis/normalizeWorkerResult.js
- Node에서 Python pose worker 실행
- worker raw output을 SwingAnalysisResult로 정규화
- low-confidence club은 손목 기반 virtual club으로 fallback

workers/pose/analyze_pose.py
- MediaPipe solutions 기반 2D pose baseline
- MediaPipe 네이티브 오류 격리 및 fallback pose output
- OpenCV Hough line 기반 club shaft 후보 검출
- 외부 club detector command adapter 지원

workers/pose/render_pose_preview.py
workers/pose/inspect_pose_quality.py
- overlay contact sheet 생성
- keypoint/club detector 품질 리포트 생성

src/app/SwingAiPage.tsx
- 스윙 AI 화면 추가
- 영상 선택 UI
- 클럽 종류, 촬영 각도, 주 사용 손 입력
- mock skeleton/club line/phase/recommendation 표시
- 실제 업로드 영상 status polling
- 영상 currentTime 기준 skeleton/club overlay 동기화
- phase timeline seek
- phase 수동 보정 UI
- club grip/head 수동 보정 UI

src/app/App.tsx
src/components/layout/AppShell.tsx
- /swing-ai 라우팅 및 메뉴 추가

src/styles/global.css
- 스윙 분석 화면 스타일 추가
```

검증 완료:

```text
npm run build 통과
node --check server/server.js 통과
임시 API에서 분석 생성/status/frame 조회 정상
npm run check:pose -- --require-real /tmp/golfdb-test-video.mp4 통과
npm run preview:pose -- --require-real /tmp/golfdb-test-video.mp4 /tmp/golflog-pose-preview.jpg 통과
npm run inspect:pose -- --require-real /tmp/golfdb-test-video.mp4 /tmp/golflog-pose-quality.md 통과
phase 보정 반복 저장 시 tempo/club path/score/recommendation 정합성 확인
npm run check:payload 통과
http://127.0.0.1:3001/api/health 정상
http://127.0.0.1:5173/swing-ai 응답 정상
```

현재 한계:

```text
실제 2D pose baseline은 동작하지만 최종 전용 모델은 아니다.
club 검출은 OpenCV baseline + 외부 command adapter 상태이며, 전용 학습 모델은 아직 연결되지 않았다.
phase 자동 분할은 rule 기반 baseline이다.
3D pose, ROM, 개인 골격 기반 retargeting, IK ghost swing은 아직 구현 전이다.
개인 실제 스윙 영상 기준 QA는 아직 필요하다.
```

### 15.2 현재 GolfLog repo 기준 구조와 분리 후보

기존 지침서의 장기 구조는 FastAPI 기반으로 작성되어 있지만, 현재 GolfLog는 이미 Node 로컬 API가 존재한다. 따라서 실제 구현은 다음 구조로 진행한다.

```text
GolfLog/
 ├─ src/
 │   ├─ app/
 │   │   └─ SwingAiPage.tsx
 │   └─ data/
 │       └─ schema.ts
 │
 ├─ server/
 │   ├─ server.js
 │   └─ analysis/
 │       ├─ storage.js
 │       ├─ runPoseWorker.js
 │       ├─ normalizeWorkerResult.js
 │       └─ metrics.js                 # 분리 후보
 │
 ├─ workers/
 │   └─ pose/
 │       ├─ analyze_pose.py
 │       ├─ render_pose_preview.py
 │       ├─ inspect_pose_quality.py
 │       ├─ phases.py                  # 분리 후보
 │       ├─ metrics.py                 # 분리 후보
 │       ├─ feedback.py                # 분리 후보
 │       ├─ requirements.txt
 │       └─ README.md
 │
 ├─ docs/
 │   ├─ SWING_AI_PROGRESS_PLAN.md
 │   ├─ CLUB_MODEL_ADAPTER.md
 │   └─ COPYRIGHT_AND_DATA_POLICY.md
 │
 └─ /Volumes/X31/golflog-data/          # Git 밖 운영 데이터
     ├─ golflog.json
     └─ models/
```

원칙:

```text
프론트엔드: 촬영/업로드/재생/overlay/리포트 UI
Node API: 로컬 파일 저장, job 상태 관리, Python worker 호출, 결과 JSON 정규화
Python worker: pose 추정, phase 추정, metric 계산, feedback 초안 생성
```

현재는 `SwingAiPage.tsx`와 `server/server.js`에 기능이 다소 집중되어 있다. 다음 UI/서버 리팩터링 시 `src/components/swing-ai/`와 `server/analysis/metrics.js`로 분리하는 것이 좋다.

### 15.3 Phase 1 목표: 실제 2D pose worker 연결

Phase 1의 목표는 “완성형 AI 코치”가 아니라, mock 결과를 실제 영상 기반 2D skeleton 결과로 교체하는 것이다. 이 목표는 baseline 기준으로 완료됐다.

최종 흐름:

```text
사용자가 /swing-ai에서 영상 선택
→ POST /api/analysis
→ Node가 영상을 로컬 데이터 디렉터리의 videos/ 하위에 저장
→ Node가 workers/pose/analyze_pose.py 실행
→ Python worker가 frame별 keypoint JSON 생성
→ Node가 worker output을 SwingAnalysisResult 스키마로 정규화
→ 로컬 데이터 디렉터리의 analysis/ 하위에 결과 JSON 저장
→ 프론트가 status polling 후 결과 조회
→ 영상 위에 실제 skeleton overlay 표시
```

완료 기준:

```text
POST /api/analysis에 실제 영상 파일 업로드 가능
로컬 데이터 디렉터리의 videos/ 하위에 업로드 영상 저장
로컬 데이터 디렉터리의 analysis/ 하위에 결과 JSON 저장
GET /api/analysis/{analysisId}/status가 queued/processing/completed/failed 반환
GET /api/analysis/{analysisId}/frames/{frame}가 실제 keypoint 반환
/swing-ai에서 업로드 영상 위에 실제 skeleton overlay 표시
```

### 15.4 Node API 구현 지침

#### 15.4.1 업로드 처리

`POST /api/analysis`는 multipart/form-data를 받아야 한다.

Form fields:

```text
video: File
club: Driver | Wood | Hybrid | 4I | 5I | 6I | 7I | 8I | 9I | PW | AW | SW
viewAngle: down-the-line | face-on
dominantHand: right | left
videoName: string
```

응답:

```json
{
  "analysisId": "ana_20260430_xxxxxx",
  "status": "queued"
}
```

저장 위치:

```text
{GOLFLOG_DATA_FILE directory}/videos/{analysisId}...
{GOLFLOG_DATA_FILE directory}/analysis/{analysisId}.json
```

job metadata 예시:

```json
{
  "analysisId": "ana_20260430_xxxxxx",
  "status": "processing",
  "progress": 35,
  "currentStage": "pose2d_estimation",
  "videoPath": "/Volumes/X31/golflog-data/videos/ana_20260430_xxxxxx.mp4",
  "resultPath": "/Volumes/X31/golflog-data/analysis/ana_20260430_xxxxxx.json",
  "createdAt": "2026-04-30T00:00:00.000Z",
  "updatedAt": "2026-04-30T00:00:03.000Z",
  "error": null
}
```

#### 15.4.2 Python worker 실행

파일:

```text
server/analysis/runPoseWorker.js
```

역할:

```text
- Python 실행 파일 경로 확인
- workers/pose/analyze_pose.py 호출
- --video, --out 인자 전달
- stderr 수집
- exit code가 0이 아니면 job failed 처리
```

예시 인터페이스:

```js
runPoseWorker({
  videoPath,
  outputPath,
  model: "mediapipe",
  viewAngle,
  clubType,
  dominantHand
});
```

Node는 Python worker의 raw output을 그대로 프론트에 반환하지 않는다. 반드시 `normalizeWorkerResult.js`에서 현재 `src/data/schema.ts` 구조에 맞춰 정규화한다.

### 15.5 Python worker 구현 지침

파일:

```text
workers/pose/analyze_pose.py
```

초기 baseline은 MediaPipe Pose를 사용한다. 이는 최종 모델이 아니라 pipeline 검증용이다. 이후 동일한 출력 스키마를 유지하면서 MMPose, ViTPose, GolfPose로 교체한다.

명령 형식:

```bash
python workers/pose/analyze_pose.py \
  --video /path/to/swing.mp4 \
  --out /tmp/golflog-worker.json \
  --model mediapipe \
  --runtime auto \
  --view-angle down-the-line \
  --club-type Driver \
  --dominant-hand right
```

worker raw output:

```json
{
  "model": "mediapipe",
  "fps": 30,
  "width": 1080,
  "height": 1920,
  "frames": [
    {
      "frame": 0,
      "time": 0.0,
      "keypoints": {
        "left_shoulder": [420.1, 512.5, 0.98],
        "right_shoulder": [522.4, 515.2, 0.97],
        "left_hip": [438.2, 820.4, 0.94]
      }
    }
  ],
  "debug": {
    "runtime": "mediapipe_solutions",
    "frameCount": 124,
    "droppedFrames": 0,
    "clubDetectedFrames": 30,
    "clubDetector": {
      "mode": "auto",
      "externalConfigured": false,
      "externalDetectedFrames": 0,
      "externalFailedFrames": 0,
      "opencvDetectedFrames": 30
    }
  }
}
```

MediaPipe keypoint 이름은 snake_case로 정규화한다.

예:

```text
LEFT_SHOULDER → left_shoulder
RIGHT_HIP → right_hip
LEFT_WRIST → left_wrist
```

### 15.6 프론트엔드 구현 지침

#### 15.6.1 컴포넌트 분리

`SwingAiPage.tsx`가 너무 커지면 안 된다. 다음 컴포넌트로 분리한다.

```text
src/components/swing-ai/VideoUploader.tsx
src/components/swing-ai/SwingVideoPlayer.tsx
src/components/swing-ai/SkeletonOverlay.tsx
src/components/swing-ai/ClubPathOverlay.tsx
src/components/swing-ai/PhaseTimeline.tsx
src/components/swing-ai/AnalysisReportPanel.tsx
src/components/swing-ai/AnalysisStatusPanel.tsx
```

#### 15.6.2 Skeleton overlay

프론트는 video currentTime으로 현재 frame을 계산한다.

```ts
const currentFrame = Math.round(currentTime * analysis.video.fps);
const poseFrame = poseFrameMap.get(currentFrame);
```

MediaPipe baseline bone mapping:

```ts
export const MEDIAPIPE_BONES = [
  ["left_shoulder", "right_shoulder"],
  ["left_shoulder", "left_elbow"],
  ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"],
  ["right_elbow", "right_wrist"],
  ["left_shoulder", "left_hip"],
  ["right_shoulder", "right_hip"],
  ["left_hip", "right_hip"],
  ["left_hip", "left_knee"],
  ["left_knee", "left_ankle"],
  ["right_hip", "right_knee"],
  ["right_knee", "right_ankle"]
] as const;
```

렌더링 규칙:

```text
confidence < 0.4인 keypoint는 표시하지 않는다.
bone 양끝 중 하나라도 confidence < 0.4이면 해당 line은 표시하지 않는다.
영상 표시 크기와 원본 video width/height가 다르면 scaleX, scaleY를 적용한다.
```

#### 15.6.3 Status polling

분석 요청 후 status를 polling한다.

```text
queued → processing → completed
queued → processing → failed
```

polling interval:

```text
개인 로컬 사용 기준 1000ms 또는 2000ms
```

completed가 되면 결과 조회 후 overlay를 표시한다.

### 15.7 Phase 2: swing phase 자동 추정

Phase 2에서는 처음부터 SwingNet을 붙이지 말고, 실제 pose/club trajectory 기반 heuristic을 먼저 구현한다. 현재 rule 기반 baseline은 구현됐고, GolfDB/SwingNet 계열 모델 검토가 남아 있다.

초기 heuristic:

```text
address:
- 영상 초반
- 손목/어깨/골반 움직임이 가장 작은 안정 구간

top:
- top 이후 downswing 이전
- 손목 또는 hand_center의 y값이 가장 높거나
- hand_center 속도 방향이 전환되는 지점

impact:
- top 이후 손목/hand_center가 address 근처로 돌아오는 구간
- club head가 추정되면 club head 속도가 최대인 근처
- 클럽이 없으면 hand_center가 몸 중앙 하단에 가까운 지점

finish:
- impact 이후 움직임이 다시 안정화되는 마지막 구간
```

출력은 기존 `phases` 스키마를 유지한다.

완료 기준:

```text
address/top/impact/finish 최소 4개 phase 자동 생성
프론트 timeline에서 phase marker 표시
추천 카드 클릭 시 해당 phase로 seek
phase 수동 보정 저장
phase 보정 후 tempo/club path/score/recommendation 재계산
```

### 15.8 Phase 3: biomechanical metric 최소 구현

Phase 3에서는 다음 8개 metric을 먼저 실제 계산한다.

```text
address_spine_angle
head_sway
pelvis_sway
left_arm_bend_at_top
trail_knee_stability
shoulder_turn_estimate
hip_turn_estimate
early_extension_proxy
```

계산 위치:

```text
초기: workers/pose/metrics.py
장기: packages/biomechanics 또는 workers/pose/metrics.py 유지
```

metric output 예시:

```json
{
  "address_spine_angle": 38.2,
  "head_sway": 42.0,
  "pelvis_sway": 28.5,
  "left_arm_bend_at_top": 17.3,
  "trail_knee_stability": 0.82,
  "shoulder_turn_estimate": 74.5,
  "hip_turn_estimate": 39.1,
  "early_extension_proxy": 0.11
}
```

### 15.9 Phase 4: 추천 엔진 실제화

초기 추천은 rule-based로 구현한다.

파일:

```text
workers/pose/feedback.py
```

또는 Node에서 처리할 경우:

```text
server/analysis/recommendations.js
```

규칙 예시:

```text
head_sway가 기준 이상이면 backswing 축 이동 피드백
left_arm_bend_at_top이 기준 이상이면 top에서 왼팔 구조 피드백
address_spine_angle이 너무 서거나 숙이면 setup 피드백
early_extension_proxy가 기준 이상이면 downswing/impact 피드백
```

각 추천은 반드시 다음 필드를 포함한다.

```json
{
  "id": "excessive_head_sway",
  "priority": 1,
  "severity": "medium",
  "targetPhase": "backswing",
  "title": "백스윙 중 머리 이동이 큽니다",
  "evidenceMetrics": {
    "head_sway": 42.0
  },
  "reason": "상체 회전 대신 몸 전체가 오른쪽으로 밀리는 패턴일 수 있습니다.",
  "suggestion": "오른쪽으로 밀기보다 흉추 회전으로 백스윙을 만드세요.",
  "drill": "거울 앞에서 머리 위치를 고정하고 50% 속도로 하프스윙을 반복하세요.",
  "safetyNote": "허리를 억지로 비틀지 말고 통증이 있으면 즉시 중단하세요.",
  "overlayFrameRange": [12, 94]
}
```

### 15.10 Phase 5 이후: 원래 목표 기능 연결

다음 기능은 Phase 1~4의 실제 데이터가 안정화된 뒤 붙인다.

```text
GolfPose / ViTPose 모델 교체
club head / grip / shaft keypoint 검출
VideoPose3D / MixSTE 기반 3D pose lifting
Body scan / ROM 측정 페이지
reference swing 등록
motion retargeting
IK 기반 ghost swing
ghost swing overlay
```

중요 원칙:

```text
모델이 바뀌어도 프론트 스키마는 바뀌면 안 된다.
Python worker output은 항상 Node에서 정규화한다.
mock result와 실제 result는 같은 SwingAnalysisResult 타입을 사용한다.
```

### 15.11 다음 커밋 목표

현재 local pose worker pipeline 범위는 이미 완료됐다. 다음 커밋 후보:

```text
feat: evaluate GolfDB phase model baseline
```

포함 작업:

```text
- GolfDB/SwingNet 계열 phase 모델 구조 검토
- 현재 rule 기반 phase 결과와 비교할 평가 스키마 정의
- 샘플 영상은 Git 밖 로컬 경로에서만 사용
- 모델/데이터셋 라이선스와 사용 범위 문서화
```

검증 명령:

```bash
npm run build
node --check server/server.js
npm run check:payload
npm run check:pose -- --require-real /path/to/swing.mp4
npm run inspect:pose -- --require-real /path/to/swing.mp4 /tmp/golflog-pose-quality.md
```

수동 검증:

```text
http://127.0.0.1:3001/api/health 정상
http://127.0.0.1:5173/swing-ai 정상
영상 업로드 후 status completed
결과 화면에서 실제 skeleton overlay 표시
GET /api/analysis/{analysisId}/frames/{frame} 실제 keypoint 반환
```

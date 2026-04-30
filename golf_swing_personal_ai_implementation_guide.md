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
  title: "손목 가동범위 대비 코킹이 과합니다"
  suggestion: "강한 래그를 억지로 만들기보다 몸통 회전과 릴리즈 타이밍으로 보완하세요."
```

### 11.5 Late pelvis lead

```yaml
id: late_pelvis_lead
phase: transition
metric: pelvis_lead_time
threshold:
  warning: 0.08
  high: 0.12
feedback:
  title: "전환 구간에서 골반 리드가 늦습니다"
  suggestion: "탑 이후 팔을 먼저 내리지 말고 왼쪽 골반이 먼저 열리는 cue를 사용하세요."
```

---

## 12. 프론트엔드 구현 지침

### 12.1 페이지

```text
/
 /analyze
 /analysis/:analysisId
 /body-profile
 /reference-swings
 /history
 /settings
```

### 12.2 컴포넌트

```text
components/
 ├─ video/
 │   ├─ VideoUploader.tsx
 │   ├─ VideoPlayer.tsx
 │   ├─ FrameScrubber.tsx
 │   └─ PhaseTimeline.tsx
 │
 ├─ overlay/
 │   ├─ SkeletonOverlay.tsx
 │   ├─ GhostSwingOverlay.tsx
 │   ├─ ClubPathOverlay.tsx
 │   ├─ JointAngleOverlay.tsx
 │   └─ RiskHighlightOverlay.tsx
 │
 ├─ report/
 │   ├─ SwingScoreCard.tsx
 │   ├─ RecommendationCard.tsx
 │   ├─ BodyProfileCard.tsx
 │   ├─ PhaseFeatureTable.tsx
 │   └─ BeforeAfterComparison.tsx
 │
 └─ bodyProfile/
     ├─ RomTestRecorder.tsx
     ├─ BodyRatioForm.tsx
     └─ RomResultPanel.tsx
```

### 12.3 Overlay 동기화

비디오의 currentTime을 frame으로 변환한다.

```ts
const currentFrame = Math.round(currentTime * fps);
const pose = poseByFrame.get(currentFrame);
const ghost = ghostByFrame.get(currentFrame);
```

반드시 `poseByFrame`은 Map으로 만든다.

```ts
const poseByFrame = useMemo(() => {
  return new Map(result.pose2d.map((f) => [f.frame, f]));
}, [result.pose2d]);
```

### 12.4 Skeleton overlay

SVG 또는 Canvas를 사용한다. 초기에는 SVG 권장.

요구사항:

- confidence < 0.4인 keypoint는 표시하지 않음
- missing keypoint는 interpolation된 값이면 점선으로 표시
- ghost는 opacity 0.35로 표시
- 위험 joint는 빨간 halo 표시
- 추천 card 클릭 시 해당 frame range로 이동

---

## 13. 테스트 기준

### 13.1 Unit tests

```text
- angle calculation
- distance normalization
- phase slicing
- smoothing/interpolation
- rule condition evaluation
- JSON schema validation
```

### 13.2 Integration tests

```text
- video upload → analysis result
- analysis result → frontend overlay
- body profile → recommendation constraint
- reference swing → ghost swing
```

### 13.3 Accuracy tests

```text
- GolfDB event detection PCE
- GolfPose 2D AP/PCK
- 3D MPJPE
- club head path stability
- phase-specific feature stability
```

### 13.4 User-level acceptance

```text
- 분석이 5분 이내 완료되는가
- overlay가 영상과 1 frame 이상 어긋나지 않는가
- 추천이 수치 근거를 갖는가
- 사용자의 ROM을 초과한 자세를 추천하지 않는가
```

---

## 14. 개발자가 바로 시작할 작업 목록

### Sprint 1: Foundation

- [ ] mono repo 생성
- [ ] FastAPI local server 생성
- [ ] React app 생성
- [ ] `AnalysisResult` schema 정의
- [ ] mock result JSON 생성
- [ ] video player + skeleton overlay 구현

### Sprint 2: Pose2D

- [ ] OpenCV frame extraction
- [ ] MediaPipe baseline pose2d
- [ ] MMPose 설치
- [ ] RTMPose/ViTPose inference wrapper
- [ ] keypoint smoothing/interpolation
- [ ] club keypoint placeholder schema

### Sprint 3: Swing phase

- [ ] GolfDB 다운로드/정리 가이드 작성
- [ ] SwingNet baseline 실행
- [ ] phase detector wrapper
- [ ] 수동 phase correction UI

### Sprint 4: Biomechanics

- [ ] angle utility 구현
- [ ] spine angle, knee angle, shoulder turn 계산
- [ ] head/pelvis sway 계산
- [ ] early extension proxy 계산
- [ ] feature JSON 저장

### Sprint 5: Body profile

- [ ] ROM test recorder UI
- [ ] ROM analysis pipeline
- [ ] body profile JSON 저장
- [ ] recommendation rule에서 ROM 참조

### Sprint 6: Recommendation

- [ ] YAML rule engine
- [ ] priority scoring
- [ ] evidence metrics 연결
- [ ] report UI 구현

### Sprint 7: Pose3D

- [ ] VideoPose3D/MixSTE wrapper
- [ ] GolfPose-3D checkpoint 사용 가능성 확인
- [ ] 3D skeleton viewer
- [ ] 3D joint angle calculation

### Sprint 8: Retargeting & IK

- [ ] reference swing 등록
- [ ] phase alignment
- [ ] segment-length retargeting
- [ ] ROM clipping
- [ ] IK solver prototype
- [ ] ghost swing overlay

---

## 15. Repository coding conventions

### 15.1 Python

- 모든 분석 함수는 pure function에 가깝게 작성한다.
- 입력/출력은 Pydantic model 또는 dataclass로 고정한다.
- 모델 inference와 feature 계산을 분리한다.
- feature 계산 함수는 테스트 가능해야 한다.

예:

```python
def compute_spine_angle(pose: Pose3DFrame) -> float:
    ...
```

나쁜 예:

```python
def analyze_everything(video_path):
    ...
```

### 15.2 Frontend

- 서버 결과 schema를 그대로 타입으로 정의한다.
- overlay 컴포넌트는 rendering만 담당한다.
- 수치 계산은 frontend에서 하지 않는다.
- `useAnalysisResult`, `useVideoTime`, `useOverlayFrame` hook으로 분리한다.

### 15.3 Data

- 원본 영상은 수정하지 않는다.
- 모든 중간 산출물은 analysis_id 폴더에 저장한다.

```text
data/analysis_results/{analysis_id}/
 ├─ metadata.json
 ├─ pose2d.json
 ├─ pose3d.json
 ├─ phases.json
 ├─ features.json
 ├─ recommendations.json
 └─ ghost_swing.json
```

---

## 16. 주요 구현 난점과 해결 전략

### 16.1 클럽 헤드 추적

문제:

- motion blur
- shaft가 얇음
- impact 부근 속도 빠름

해결:

- 120fps 이상 권장
- club keypoint 전용 detector 학습
- shaft line fitting
- optical flow 보조
- phase-aware smoothing

### 16.2 단안 3D pose 오차

문제:

- depth ambiguity
- self-occlusion
- golf top/impact rare pose

해결:

- GolfPose/GolfSwing fine-tuning 우선
- 2-view 옵션 지원
- kinematic constraints 적용
- impossible joint angle filtering

### 16.3 ROM 추정 오차

문제:

- 카메라 각도에 따라 실제 회전량 왜곡
- 사용자가 테스트 동작을 제대로 하지 않음

해결:

- 촬영 가이드 overlay
- confidence 낮으면 재촬영 요청
- 정면/측면 선택
- 보수적 constraint 적용

### 16.4 최적 자세 추천 리스크

문제:

- 잘못된 자세 추천은 부상 위험
- “최적”의 정의가 사용자 목표마다 다름

해결:

- 목표별 weight 사용
- ROM 초과 추천 금지
- safety score가 낮은 ghost swing 폐기
- 리포트에 “운동학적 참고”로 표시

---

## 17. 참고 링크

- GolfDB GitHub: https://github.com/wmcnally/golfdb
- GolfDB paper: https://openaccess.thecvf.com/content_CVPRW_2019/html/CVSports/McNally_GolfDB_A_Video_Database_for_Golf_Swing_Sequencing_CVPRW_2019_paper.html
- GolfPose GitHub: https://github.com/MingHanLee/GolfPose
- GolfPose paper: https://minghanlee.github.io/papers/ICPR_2024_GolfPose.pdf
- AthletePose3D GitHub: https://github.com/calvinyeungck/AthletePose3D
- AthletePose3D CVPRW: https://openaccess.thecvf.com/content/CVPR2025W/CVSPORTS/html/Yeung_AthletePose3D_A_Benchmark_Dataset_for_3D_Human_Pose_Estimation_and_CVPRW_2025_paper.html
- VideoPose3D GitHub: https://github.com/facebookresearch/VideoPose3D
- MMPose: https://mmpose.com/
- MediaPipe Pose docs: https://mediapipe.readthedocs.io/en/latest/solutions/pose.html
- OpenSim documentation: https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53089279/Documentation
- Pinocchio documentation: https://docs.ros.org/en/rolling/p/pinocchio/doc/Overview.html
- Pink IK: https://pypi.org/project/pin-pink/

---

## 18. 최종 구현 방향

처음 구현은 단순해야 하지만, 설계는 축소하면 안 된다.  
따라서 모든 모듈은 최종 목표 기준으로 인터페이스를 먼저 고정하고, 내부 구현만 단계적으로 교체한다.

초기에는 다음처럼 시작한다.

```text
MediaPipe/RTMPose baseline
→ GolfPose로 교체
→ VideoPose3D/MixSTE 3D 복원
→ Body Profile/ROM 추가
→ Rule-based recommendation
→ Reference retargeting
→ IK ghost swing
```

프론트엔드는 처음부터 ghost swing과 phase timeline을 받을 수 있는 schema로 설계한다.  
백엔드는 처음에는 mock 또는 baseline 값을 넣더라도, 결과 JSON 구조는 최종 구조를 유지한다.

이 원칙을 지키면, 단순 자세 분석 앱에서 끝나지 않고 **사용자 몸에 맞는 개인화 골프 스윙 최적화 시스템**으로 확장할 수 있다.

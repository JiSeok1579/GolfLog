import { useState, type FormEvent } from "react";
import { Save } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Chip } from "../components/ui/Chip";
import { StatCard } from "../components/ui/StatCard";
import { text, useLanguage, type Language } from "../data/i18n";
import { cleanNumberInput } from "../data/numberInput";
import { latestWeight } from "../data/selectors";
import { profileInputSchema, type ProfileInput } from "../data/schema";
import { useGolfLog } from "../data/store";
import { formatDistance, formatWeight, type DistanceUnit, type WeightUnit } from "../data/units";

function optionalInteger(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
}

function requiredNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function SettingsPage() {
  const { data, updateProfile } = useGolfLog();
  const { language, setLanguage } = useLanguage();
  const profile = data.profile;
  const [name, setName] = useState(profile.name);
  const [heightCm, setHeightCm] = useState(String(profile.heightCm));
  const [birthYear, setBirthYear] = useState(profile.birthYear ? String(profile.birthYear) : "");
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>(profile.distanceUnit);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(profile.weightUnit);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const currentWeight = latestWeight(data);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSaved("");

    const nextProfile: ProfileInput = {
      name: name.trim(),
      heightCm: requiredNumber(heightCm),
      birthYear: optionalInteger(birthYear),
      distanceUnit,
      weightUnit,
    };
    const result = profileInputSchema.safeParse(nextProfile);
    if (!result.success) {
      setError(text(language, "프로필 입력값을 다시 확인해주세요.", "Check the profile values."));
      return;
    }

    updateProfile(result.data);
    setSaved(text(language, "설정을 저장했습니다.", "Settings saved."));
  };

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>{text(language, "설정", "Settings")}</h1>
          <p>{text(language, "프로필과 앱 전체 거리·체중 표시 단위를 관리합니다.", "Manage profile details and app-wide distance and weight units.")}</p>
        </div>
        <Chip tone="accent">
          {distanceUnit} · {weightUnit}
        </Chip>
      </header>

      <div className="settings-stat-grid">
        <StatCard delta="Profile" label={text(language, "사용자", "User")} value={profile.name} />
        <StatCard delta="Height" label="Height" unit="cm" value={String(profile.heightCm)} />
        <StatCard delta="Distance" label="Distance Unit" value={profile.distanceUnit} />
        <StatCard delta="Weight" label="Weight Unit" value={profile.weightUnit} />
        <StatCard delta="Language" label={text(language, "언어", "Language")} value={language === "en" ? "English" : "한국어"} />
      </div>

      <form className="settings-grid" onSubmit={submit}>
        <Card>
          <div className="card-title-row">
            <div>
              <p className="card-kicker">Profile</p>
              <h2>{text(language, "사용자 정보", "User Info")}</h2>
            </div>
          </div>
          <div className="form-grid">
            <label className="field">
              {text(language, "이름", "Name")}
              <input onChange={(event) => setName(event.target.value)} value={name} />
            </label>
            <label className="field">
              {text(language, "키 cm", "Height cm")}
              <input inputMode="decimal" onChange={(event) => setHeightCm(cleanNumberInput(event.target.value, { decimal: true }))} value={heightCm} />
            </label>
            <label className="field">
              {text(language, "출생연도", "Birth Year")}
              <input inputMode="numeric" onChange={(event) => setBirthYear(cleanNumberInput(event.target.value))} placeholder={text(language, "선택", "Optional")} value={birthYear} />
            </label>
          </div>
        </Card>

        <div className="form-stack">
          <Card>
            <div className="card-title-row">
              <div>
                <p className="card-kicker">Units</p>
                <h2>{text(language, "표시 단위", "Display Units")}</h2>
              </div>
            </div>
            <div className="unit-control-list">
              <div className="unit-control">
                <span>{text(language, "거리", "Distance")}</span>
                <div className="segmented-control" role="group" aria-label="Distance unit">
                  {(["m", "yd"] as const).map((unit) => (
                    <button className={distanceUnit === unit ? "active" : ""} key={unit} onClick={() => setDistanceUnit(unit)} type="button">
                      {unit}
                    </button>
                  ))}
                </div>
              </div>
              <div className="unit-control">
                <span>{text(language, "체중", "Weight")}</span>
                <div className="segmented-control" role="group" aria-label="Weight unit">
                  {(["kg", "lb"] as const).map((unit) => (
                    <button className={weightUnit === unit ? "active" : ""} key={unit} onClick={() => setWeightUnit(unit)} type="button">
                      {unit}
                    </button>
                  ))}
                </div>
              </div>
              <div className="unit-control">
                <span>{text(language, "언어", "Language")}</span>
                <div className="segmented-control" role="group" aria-label={text(language, "언어", "Language")}>
                  {(["ko", "en"] as Language[]).map((option) => (
                    <button className={language === option ? "active" : ""} key={option} onClick={() => setLanguage(option)} type="button">
                      {option === "ko" ? "한국어" : "English"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="card-title-row">
              <div>
                <p className="card-kicker">Preview</p>
                <h2>{text(language, "단위 미리보기", "Unit Preview")}</h2>
              </div>
            </div>
            <div className="settings-preview-list">
              <div>
                <span>{text(language, "드라이버 230m", "Driver 230m")}</span>
                <strong>{formatDistance(230, distanceUnit)}</strong>
              </div>
              <div>
                <span>{text(language, "최근 체중", "Latest Weight")}</span>
                <strong>{formatWeight(currentWeight, weightUnit)}</strong>
              </div>
            </div>
          </Card>
        </div>

        <div className="settings-save-panel">
          {error ? <div className="form-error">{error}</div> : null}
          {saved ? <div className="form-success">{saved}</div> : null}
          <div className="save-row">
            <Button type="submit">
              <Save size={16} />
              {text(language, "설정 저장", "Save Settings")}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}
